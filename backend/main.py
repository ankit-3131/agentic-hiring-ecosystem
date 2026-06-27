from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os, io, json, PyPDF2
from datetime import datetime, timezone
from bson import ObjectId
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')

import database as db
from schemas import (
    UserCreate, UserLogin, CandidateProfileCreate, CandidateProfileUpdate,
    ConsentUpdate, JobCreate, JobUpdate, AgencyAssign, StageUpdate,
    RejectApplication, StepCompletion, MessageCreate, InterviewStart, AnswerSubmit,
    AiInterviewOverrideRequest
)
from agents.agent_workflow import (
    run_resume_screening,
    run_resume_parsing,
    generate_interview_questions,
    review_interview_answers,
    compute_skill_gap,
    generate_next_interview_question,
    evaluate_interview_transcript,
)
import socketio

app = FastAPI(title="Talent Scout AI – MongoDB Backend")

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _id(doc: dict) -> dict:
    """Convert ObjectId fields to strings for JSON serialisation."""
    if doc is None:
        return {}
    doc["id"] = str(doc.pop("_id", ""))
    return doc


def _ids(docs: list) -> list:
    return [_id(d) for d in docs]


def _serialize_message_socket(doc: dict) -> dict:
    mid = doc.get("_id")
    if mid is not None:
        mid = str(mid)
    mt = doc.get("msg_type", "message")
    return {
        "id": mid,
        "application_id": doc.get("application_id", ""),
        "from_id": doc.get("from_id", ""),
        "from_name": doc.get("from_name", ""),
        "to_id": doc.get("to_id", ""),
        "content": doc.get("content", ""),
        "msg_type": mt,
        "type": mt,
        "job_title": doc.get("job_title", ""),
        "timestamp": doc.get("timestamp", ""),
        "read": doc.get("read", False),
    }


async def emit_new_message(doc: dict) -> None:
    payload = _serialize_message_socket(doc)
    aid = payload.get("application_id") or ""
    if not aid:
        return
    await sio.emit("message:new", payload, room=f"thread_{aid}")
    to_id = payload.get("to_id") or ""
    from_id = payload.get("from_id") or ""
    if to_id:
        await sio.emit("message:new", payload, room=f"user_{to_id}")
    if from_id:
        await sio.emit("message:new", payload, room=f"user_{from_id}")


@sio.on("join_user")
async def sio_join_user(sid, data):
    uid = (data or {}).get("user_id")
    if uid:
        await sio.enter_room(sid, f"user_{uid}")


@sio.on("join_thread")
async def sio_join_thread(sid, data):
    aid = (data or {}).get("application_id")
    if aid:
        await sio.enter_room(sid, f"thread_{aid}")


@sio.on("leave_thread")
async def sio_leave_thread(sid, data):
    aid = (data or {}).get("application_id")
    if aid:
        await sio.leave_room(sid, f"thread_{aid}")


def now() -> datetime:
    return datetime.now(timezone.utc)


def _derive_profile_updates_from_parsed(parsed_data: dict) -> dict:
    updates = {}
    if not parsed_data:
        return updates
    if parsed_data.get("skills"):
        updates["skills"] = parsed_data.get("skills")
    if parsed_data.get("summary"):
        updates["summary"] = parsed_data.get("summary")
    if parsed_data.get("projects"):
        # keep a human-readable text for quick display, plus structured parsed object
        if isinstance(parsed_data.get("projects"), list):
            updates["projects"] = "\n".join(
                f"{p.get('title', '')}: {p.get('description', '')} (metrics: {p.get('metrics', '')})".
                strip() for p in parsed_data.get("projects", [])
            )
        else:
            updates["projects"] = str(parsed_data.get("projects"))
    if parsed_data.get("achievements"):
        if isinstance(parsed_data.get("achievements"), list):
            updates["achievements"] = parsed_data.get("achievements")
        else:
            updates["achievements"] = [str(parsed_data.get("achievements"))]
    if parsed_data.get("experience"):
        updates["experience"] = parsed_data.get("experience")
    if parsed_data.get("education"):
        updates["education"] = parsed_data.get("education")
    updates["parsed_resume"] = parsed_data
    return updates


def extract_pdf(data: bytes) -> str:
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    except Exception:
        return ""


@app.on_event("startup")
async def startup():
    await db.init_indexes()
    await _seed_demo_users()


async def _seed_demo_users():
    count = await db.users_col.count_documents({})
    if count == 0:
        demo = [
            {"name": "Priya Kapoor", "email": "candidate@test.com", "password": "password", "role": "Candidate"},
            {"name": "Razorpay HR", "email": "employer@test.com", "password": "password", "role": "Employer"},
            {"name": "Admin User", "email": "admin@test.com", "password": "password", "role": "Admin"},
        ]
        await db.users_col.insert_many(demo)


@app.get("/api/health")
async def health():
    return {"status": "ok", "db": "mongodb"}

@app.post("/api/auth/register")
async def register(payload: UserCreate):
    if await db.users_col.find_one({"email": payload.email}):
        raise HTTPException(400, "Email already registered")
    doc = payload.model_dump()
    res = await db.users_col.insert_one(doc)
    return {"id": str(res.inserted_id), "name": payload.name, "email": payload.email, "role": payload.role}


@app.post("/api/auth/login")
async def login(payload: UserLogin):
    user = await db.users_col.find_one({"email": payload.email, "password": payload.password})
    if not user:
        raise HTTPException(401, "Invalid email or password")
    return {"id": str(user["_id"]), "name": user["name"], "email": user["email"], "role": user["role"]}

@app.get("/api/candidate/profile/{user_id}")
async def get_candidate_profile(user_id: str):
    profile = await db.candidate_profiles_col.find_one({"user_id": user_id})
    if not profile:
        return {}
    return _id(profile)


@app.put("/api/candidate/profile/{user_id}")
async def upsert_candidate_profile(user_id: str, payload: CandidateProfileUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = now().isoformat()
    profile = await db.candidate_profiles_col.find_one({"user_id": user_id}) or {}
    merged = {**profile, **update_data}
    fields = [
        "current_role", "experience_years", "notice_period", "location", "salary_min", "salary_max",
        "skills", "resume_text", "summary", "projects", "achievements"
    ]
    filled = sum(1 for f in fields if merged.get(f) and merged[f] not in [0, [], ""])
    update_data["profile_completeness"] = int((filled / len(fields)) * 100)
    await db.candidate_profiles_col.update_one(
        {"user_id": user_id}, {"$set": update_data}, upsert=True
    )
    profile = await db.candidate_profiles_col.find_one({"user_id": user_id})
    return _id(profile)


@app.post("/api/candidate/profile/{user_id}/resume")
async def upload_resume(user_id: str, file: UploadFile = File(...)):
    data = await file.read()
    if file.filename.endswith(".pdf"):
        text = extract_pdf(data)
    else:
        text = data.decode("utf-8", errors="ignore")
    if not text.strip():
        raise HTTPException(400, "Could not extract text from file")

    parsed = {}
    try:
        parsed_state = await run_resume_parsing(text)
        if parsed_state.get("errors"):
            parsed = {}
        else:
            parsed = parsed_state.get("parsed_data", {})
    except Exception:
        parsed = {}

    profile_update = {
        "resume_text": text,
        "resume_filename": file.filename,
        "updated_at": now().isoformat(),
        **_derive_profile_updates_from_parsed(parsed)
    }

    existing_profile = await db.candidate_profiles_col.find_one({"user_id": user_id}) or {}
    merged = {**existing_profile, **profile_update}
    fields = [
        "current_role", "experience_years", "notice_period", "location", "salary_min", "salary_max",
        "skills", "resume_text", "summary", "projects", "achievements"
    ]
    filled = sum(1 for f in fields if merged.get(f) and merged[f] not in [0, [], ""])
    profile_update["profile_completeness"] = int((filled / len(fields)) * 100)

    await db.candidate_profiles_col.update_one(
        {"user_id": user_id},
        {"$set": profile_update},
        upsert=True
    )

    return {"success": True, "filename": file.filename, "chars": len(text), "parsed_data": parsed}

@app.get("/api/candidate/agent-feed/{user_id}")
async def get_agent_feed(user_id: str):
    cursor = db.agent_activities_col.find({"candidate_id": user_id}).sort("timestamp", -1).limit(50)
    docs = await cursor.to_list(50)
    return _ids(docs)


@app.post("/api/candidate/agent-feed/{user_id}/read-all")
async def mark_feed_read(user_id: str):
    await db.agent_activities_col.update_many({"candidate_id": user_id}, {"$set": {"read": True}})
    return {"success": True}



#candidate pipeline stages

WORKFLOW_STAGES = ["applied", "ai_screen", "ai_interview", "human_screening", "offer"]

@app.get("/api/candidate/pipeline/{user_id}")
async def get_candidate_pipeline(user_id: str):
    cursor = db.applications_col.find({"candidate_id": user_id})
    apps = await cursor.to_list(200)
    result = []
    for app in apps:
        app_id = str(app["_id"])
        job = await db.jobs_col.find_one({"_id": ObjectId(app["job_id"])}) if app.get("job_id") else None
        employer = None
        if job and job.get("employer_id"):
            employer = await db.users_col.find_one({"_id": ObjectId(job["employer_id"])})
        result.append({
            "application_id": app_id,
            "job_id": app.get("job_id", ""),
            "job_title": job["title"] if job else "Unknown",
            "employer_name": job.get("employer_name", "") if job else "",
            "location": job.get("location", "") if job else "",
            "stage": app.get("stage", "applied"),
            "match_score": app.get("match_score", 0),
            "stage_history": app.get("stage_history", []),
            "completed_steps": app.get("completed_steps", []),
            "workflow_stages": WORKFLOW_STAGES,
            "created_at": app.get("created_at", ""),
            "feedback": app.get("feedback", {}),
        })
    return result

@app.post("/api/candidate/apply")
async def apply_to_job(
    candidateId: str = Form(...),
    jobId: str = Form(...),
):
    try:
        job = await db.jobs_col.find_one({"_id": ObjectId(jobId)})
    except Exception:
        raise HTTPException(400, "Invalid jobId")
    if not job:
        raise HTTPException(404, "Job not found")

    # Fetch resume_text from stored candidate profile
    profile = await db.candidate_profiles_col.find_one({"user_id": candidateId})
    if not profile or not profile.get("resume_text"):
        raise HTTPException(400, "Please upload your resume in the Profile tab first.")
    
    resume_text = profile.get("resume_text", "")
    if not resume_text.strip():
        raise HTTPException(400, "Resume is empty. Please upload a valid resume.")

    existing = await db.applications_col.find_one({"candidate_id": candidateId, "job_id": jobId})

    REAPPLYABLE_STAGES = {"rejected", "withdrawn"}
    ACTIVE_STAGES = {"applied", "ai_screen", "ai_interview", "human_screening", "offer"}

    if existing:
        existing_stage = existing.get("stage", "applied")
        if existing_stage in ACTIVE_STAGES:
            # Block reapply for any ongoing application
            raise HTTPException(409, f"You already have an active application for this job (stage: {existing_stage}). You cannot reapply while it is in progress.")
        # For rejected/withdrawn: fall through to re-run screening (no cache)

    if existing and existing.get("match_score") is not None and existing.get("stage", "") not in REAPPLYABLE_STAGES:
        # Use cached score and feedback only for non-rejected, non-withdrawn existing apps
        score = existing.get("match_score", 0)
        feedback = existing.get("feedback", {})
        parsed = existing.get("parsed_data", {})
        app_id = str(existing["_id"])
        await db.applications_col.update_one(
            {"_id": existing["_id"]},
            {
                "$set": {
                    "resume_text": resume_text,
                    "stage": existing.get("stage", "applied"),
                    "updated_at": now().isoformat(),
                }
            }
        )
        profile_updates = {
            "resume_text": resume_text,
            "updated_at": now().isoformat(),
            **_derive_profile_updates_from_parsed(parsed)
        }
        existing_profile = await db.candidate_profiles_col.find_one({"user_id": candidateId}) or {}
        merged_profile = {**existing_profile, **profile_updates}
        fields = [
            "current_role", "experience_years", "notice_period", "location", "salary_min", "salary_max",
            "skills", "resume_text", "summary", "projects", "achievements"
        ]
        filled = sum(1 for f in fields if merged_profile.get(f) and merged_profile[f] not in [0, [], ""])
        profile_updates["profile_completeness"] = int((filled / len(fields)) * 100)

        await db.candidate_profiles_col.update_one(
            {"user_id": candidateId},
            {"$setOnInsert": {"user_id": candidateId}, "$set": profile_updates},
            upsert=True
        )
        return {"success": True, "application_id": app_id, "parsedData": parsed, "scoringResult": feedback, "cached": True}

    result = await run_resume_screening(resume_text, job["description"])
    if result.get("errors"):
        raise HTTPException(500, result["errors"][0])

    score = result.get("scoring_result", {}).get("score", 0)
    feedback = result.get("scoring_result", {})
    parsed = result.get("parsed_data", {})

    # Determine next stage based on score
    if score > 25:
        next_stage = "ai_interview"
        stage_history = [
            {"stage": "applied", "timestamp": now().isoformat()},
            {"stage": "ai_screen", "timestamp": now().isoformat()},
            {"stage": "ai_interview", "timestamp": now().isoformat()}
        ]
    else:
        next_stage = "rejected"
        stage_history = [
            {"stage": "applied", "timestamp": now().isoformat()},
            {"stage": "ai_screen", "timestamp": now().isoformat()},
            {"stage": "rejected", "timestamp": now().isoformat()}
        ]

    # Upsert application (new or rewrite with latest data)
    app_doc = {
        "candidate_id": candidateId,
        "job_id": jobId,
        "stage": next_stage,
        "match_score": score,
        "feedback": feedback,
        "resume_text": resume_text,
        "parsed_data": parsed,
        "stage_history": stage_history,
        "completed_steps": [],
        "created_at": now().isoformat(),
        "updated_at": now().isoformat(),
    }
    if existing:
        await db.applications_col.update_one({"_id": existing["_id"]}, {"$set": app_doc})
        app_id = str(existing["_id"])
    else:
        res = await db.applications_col.insert_one(app_doc)
        app_id = str(res.inserted_id)

    # Update candidate profile from parsed resume data
    profile_updates = {
        "resume_text": resume_text,
        "updated_at": now().isoformat(),
        **_derive_profile_updates_from_parsed(parsed)
    }
    existing_profile = await db.candidate_profiles_col.find_one({"user_id": candidateId}) or {}
    merged_profile = {**existing_profile, **profile_updates}
    fields = [
        "current_role", "experience_years", "notice_period", "location", "salary_min", "salary_max",
        "skills", "resume_text", "summary", "projects", "achievements"
    ]
    filled = sum(1 for f in fields if merged_profile.get(f) and merged_profile[f] not in [0, [], ""])
    profile_updates["profile_completeness"] = int((filled / len(fields)) * 100)

    await db.candidate_profiles_col.update_one(
        {"user_id": candidateId},
        {"$setOnInsert": {"user_id": candidateId}, "$set": profile_updates},
        upsert=True
    )

    # Log agent activity based on outcome
    cand_user = await db.users_col.find_one({"_id": ObjectId(candidateId)})
    if next_stage == "ai_interview":
        await db.agent_activities_col.insert_one({
            "candidate_id": candidateId,
            "type": "stage_update",
            "message": f"Advanced to AI Interview for {job['title']} — {score}/100 match score",
            "job_id": jobId,
            "job_title": job["title"],
            "timestamp": now().isoformat(),
            "read": False,
        })
    else:  # rejected
        await db.agent_activities_col.insert_one({
            "candidate_id": candidateId,
            "type": "rejected",
            "message": f"Application for {job['title']} was not moved forward — {score}/100 match score",
            "job_id": jobId,
            "job_title": job["title"],
            "timestamp": now().isoformat(),
            "read": False,
        })

    return {"success": True, "application_id": app_id, "parsedData": parsed, "scoringResult": feedback}

@app.get("/api/candidate/skill-gap/{user_id}")
async def get_skill_gap(user_id: str):
    profile = await db.candidate_profiles_col.find_one({"user_id": user_id})
    if not profile:
        return {"gaps": [], "recommendations": []}
    candidate_skills = profile.get("skills", [])

    # Get all matched jobs
    cursor = db.applications_col.find({"candidate_id": user_id, "stage": {"$ne": "rejected"}})
    apps = await cursor.to_list(20)
    job_descriptions = []
    for app in apps:
        if app.get("job_id"):
            try:
                job = await db.jobs_col.find_one({"_id": ObjectId(app["job_id"])})
                if job:
                    job_descriptions.append({"title": job["title"], "description": job["description"]})
            except Exception:
                pass

    if not job_descriptions:
        return {"gaps": [], "recommendations": ["Apply to jobs to see your skill gap analysis"]}

    result = await compute_skill_gap(candidate_skills, job_descriptions)
    return result
@app.get("/api/candidate/consent/{user_id}")
async def get_consent(user_id: str):
    profile = await db.candidate_profiles_col.find_one({"user_id": user_id})
    if not profile:
        return {"share_profile": True, "agent_active": True, "salary_visible": True, "agency_visible": True}
    return profile.get("consent", {"share_profile": True, "agent_active": True, "salary_visible": True, "agency_visible": True})


@app.put("/api/candidate/consent/{user_id}")
async def update_consent(user_id: str, payload: ConsentUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    consent_update = {f"consent.{k}": v for k, v in update.items()}
    await db.candidate_profiles_col.update_one(
        {"user_id": user_id}, {"$set": consent_update}, upsert=True
    )
    profile = await db.candidate_profiles_col.find_one({"user_id": user_id})
    return profile.get("consent", {})


@app.post("/api/candidate/withdraw/{application_id}")
async def withdraw_from_pipeline(application_id: str, user_id: str):
    try:
        app = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    except Exception:
        raise HTTPException(400, "Invalid application_id")
    if not app:
        raise HTTPException(404, "Application not found")
    if app["candidate_id"] != user_id:
        raise HTTPException(403, "Forbidden")
    await db.applications_col.update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {"stage": "withdrawn", "withdrawn_at": now().isoformat()}}
    )
    return {"success": True}


#communication endpoints

@app.get("/api/candidate/messages/{user_id}")
async def get_candidate_messages(user_id: str):
    cursor = db.messages_col.find({
        "$or": [
            {"to_id": user_id},
            {"from_id": user_id},
        ]
    }).sort("timestamp", 1)
    msgs = await cursor.to_list(200)
    # Group by application_id
    grouped: dict = {}
    for m in msgs:
        aid = m.get("application_id", "")
        if aid not in grouped:
            grouped[aid] = {"application_id": aid, "job_title": m.get("job_title", ""), "messages": []}
        grouped[aid]["messages"].append({
            "id": str(m["_id"]),
            "from_id": m.get("from_id", ""),
            "from_name": m.get("from_name", ""),
            "content": m.get("content", ""),
            "type": m.get("msg_type", "message"),
            "msg_type": m.get("msg_type", "message"),
            "timestamp": m.get("timestamp", ""),
            "read": m.get("read", False),
        })
    return list(grouped.values())


@app.post("/api/candidate/messages/{application_id}/reply")
async def candidate_reply(application_id: str, payload: MessageCreate, user_id: str):
    app_doc = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    if not app_doc:
        raise HTTPException(404, "Application not found")
    if app_doc.get("candidate_id") != user_id:
        raise HTTPException(403, "You cannot reply to this application")
    sender = await db.users_col.find_one({"_id": ObjectId(user_id)})
    job = await db.jobs_col.find_one({"_id": ObjectId(app_doc["job_id"])})
    msg = {
        "application_id": application_id,
        "from_id": user_id,
        "from_name": sender["name"] if sender else "Candidate",
        "to_id": job["employer_id"] if job else "",
        "content": payload.content,
        "msg_type": payload.msg_type,
        "job_title": job["title"] if job else "",
        "timestamp": now().isoformat(),
        "read": False,
    }
    ins = await db.messages_col.insert_one(msg)
    msg["_id"] = ins.inserted_id
    await emit_new_message(msg)
    return {"success": True}


@app.post("/api/messages/{message_id}/read")
async def mark_message_read(message_id: str):
    await db.messages_col.update_one({"_id": ObjectId(message_id)}, {"$set": {"read": True}})
    return {"success": True}


@app.post("/api/candidate/mock-interview/start")
async def start_interview(payload: InterviewStart):
    MAX_QUESTIONS = 7
    app_doc = await db.applications_col.find_one({"_id": ObjectId(payload.application_id)})
    if not app_doc:
        raise HTTPException(404, "Application not found")
    job = await db.jobs_col.find_one({"_id": ObjectId(app_doc["job_id"])})
    if not job:
        raise HTTPException(404, "Job not found")

                                            
    existing = await db.interview_sessions_col.find_one({
        "application_id": payload.application_id,
        "status": "in_progress"
    })
    if existing:
                                                                          
        legacy_mode = "answer_timestamps" not in existing
        total = len(existing.get("questions", [])) if legacy_mode else MAX_QUESTIONS
        return {
            "session_id": str(existing["_id"]),
            "question": existing["questions"][existing["current_index"]],
            "index": existing["current_index"],
            "total": total,
        }

    persona = "You are a friendly but rigorous interviewer. Ask one question at a time, follow up when needed, and keep the conversation focused and respectful."
    estimated_duration_minutes = 20

                                                                  
    first = await generate_next_interview_question(
        job_title=job["title"],
        job_description=job["description"],
        persona=persona,
        questions=[],
        answers=[],
        timestamps=[],
        next_question_index=0,
        max_questions=MAX_QUESTIONS,
    )

    session_doc = {
        "application_id": payload.application_id,
        "candidate_id": payload.candidate_id,
        "job_id": str(job["_id"]),
        "job_title": job["title"],
        "job_description": job["description"],
        "persona": persona,
        "estimated_duration_minutes": estimated_duration_minutes,
        "questions": [first["question"]],
        "answers": [],
        "answer_timestamps": [],
        "status": "in_progress",
        "current_index": 0,
        "started_at": now().isoformat(),
        "created_at": now().isoformat(),
                                              
        "reviews": [],
        "overall_feedback": "",
        "gap_score": 0,
                                                             
        "overall_score": None,
        "dimension_scores": None,
        "notable_quotes": [],
        "interview_report": None,
        "recommendation": None,
        "recommendation_reasoning": "",
        "transcript": [],
        "completed_at": None,
    }
    res = await db.interview_sessions_col.insert_one(session_doc)
    return {
        "session_id": str(res.inserted_id),
        "question": first["question"],
        "index": 0,
        "total": MAX_QUESTIONS,
    }


@app.post("/api/candidate/mock-interview/{session_id}/answer")
async def submit_answer(session_id: str, payload: AnswerSubmit):
    session = await db.interview_sessions_col.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")
    if session["status"] != "in_progress":
        raise HTTPException(400, "Session already completed")

                                 
    legacy_mode = "answer_timestamps" not in session
    MAX_QUESTIONS = 7

    if legacy_mode:
        answers = session.get("answers", [])
        answers.append(payload.answer)
        next_index = session["current_index"] + 1
        total = len(session["questions"])

        await db.interview_sessions_col.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"answers": answers, "current_index": next_index}}
        )

        if next_index >= total:
                                           
            reviews, overall, gap_score = await review_interview_answers(
                session["questions"], answers, session.get("job_title", "")
            )
            await db.interview_sessions_col.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {"reviews": reviews, "overall_feedback": overall, "gap_score": gap_score, "status": "completed"}}
            )
            return {"done": True, "reviews": reviews, "overall_feedback": overall, "gap_score": gap_score}

        return {"done": False, "question": session["questions"][next_index], "index": next_index, "total": total}

                                 
    questions = session.get("questions", [])
    answers = session.get("answers", [])
    timestamps = session.get("answer_timestamps", [])
    current_index = session.get("current_index", 0)

    answers.append(payload.answer)
    timestamps.append(now().isoformat())

    next_index = current_index + 1
    persona = session.get("persona", "You are a senior technical interviewer.")
    job_title = session.get("job_title", "")
    job_description = session.get("job_description", "")

                       
    should_complete = next_index >= MAX_QUESTIONS
    generated_next = None

    if not should_complete:
        generated_next = await generate_next_interview_question(
            job_title=job_title,
            job_description=job_description,
            persona=persona,
            questions=questions,
            answers=answers,
            timestamps=timestamps,
            next_question_index=next_index,
            max_questions=MAX_QUESTIONS,
        )
        should_complete = bool(generated_next.get("should_end", False))

                                                                                        
    if not should_complete and generated_next and generated_next.get("question"):
        questions = questions + [generated_next["question"]]
        status = "in_progress"
        current_index_to_store = next_index
        update_payload = {
            "$set": {
                "answers": answers,
                "answer_timestamps": timestamps,
                "questions": questions,
                "status": status,
                "current_index": current_index_to_store,
            }
        }
        await db.interview_sessions_col.update_one({"_id": ObjectId(session_id)}, update_payload)
        return {
            "done": False,
            "question": generated_next["question"],
            "index": next_index,
            "total": MAX_QUESTIONS,
        }

                                                                   
    evaluation = await evaluate_interview_transcript(
        job_title=job_title,
        job_description=job_description,
        persona=persona,
        questions=questions,
        answers=answers,
        timestamps=timestamps,
    )

    overall_score = evaluation.get("overall_score", 0)
    dimension_scores = evaluation.get("dimension_scores", {})
    transcript = evaluation.get("transcript", [])
    notable_quotes = evaluation.get("notable_quotes", [])
    recommendation = evaluation.get("recommendation", "hold")
    recommendation_reasoning = evaluation.get("recommendation_reasoning", "")

                                                           
    reviews = [
        {
            "question": t.get("question", ""),
            "answer": t.get("answer", ""),
            "correct": True,
            "score": overall_score,
            "review": "See structured interview report for full evaluation details.",
        }
        for t in transcript
    ]

    await db.interview_sessions_col.update_one(
        {"_id": ObjectId(session_id)},
        {
            "$set": {
                "answers": answers,
                "answer_timestamps": timestamps,
                "questions": questions,
                "status": "completed",
                "completed_at": now().isoformat(),
                "overall_score": overall_score,
                "dimension_scores": dimension_scores,
                "transcript": transcript,
                "notable_quotes": notable_quotes,
                "recommendation": recommendation,
                "recommendation_reasoning": recommendation_reasoning,
                "interview_report": evaluation,
                               
                "reviews": reviews,
                "overall_feedback": recommendation_reasoning,
                "gap_score": overall_score,
            }
        },
    )

                                                                                    
    app_id = session.get("application_id", "")
    if app_id:
        try:
            app_doc = await db.applications_col.find_one({"_id": ObjectId(app_id)}) or {}
            if app_doc:
                                                           
                job = await db.jobs_col.find_one({"_id": ObjectId(app_doc.get("job_id"))}) if app_doc.get("job_id") else None
                employer_id = job.get("employer_id") if job else ""
                thresholds_doc = await db.employer_ai_interview_thresholds_col.find_one({"employer_id": employer_id})
                thresholds = thresholds_doc or {
                    "reject_cutoff": DEFAULT_AI_INTERVIEW_THRESHOLDS["reject_cutoff"],
                    "hold_cutoff": DEFAULT_AI_INTERVIEW_THRESHOLDS["hold_cutoff"],
                    "pass_cutoff": DEFAULT_AI_INTERVIEW_THRESHOLDS["pass_cutoff"],
                }

                REJECT_CUTOFF = int(thresholds.get("reject_cutoff", DEFAULT_AI_INTERVIEW_THRESHOLDS["reject_cutoff"]))
                HOLD_CUTOFF = int(thresholds.get("hold_cutoff", DEFAULT_AI_INTERVIEW_THRESHOLDS["hold_cutoff"]))
                PASS_CUTOFF = int(thresholds.get("pass_cutoff", DEFAULT_AI_INTERVIEW_THRESHOLDS["pass_cutoff"]))

                if overall_score < REJECT_CUTOFF:
                    target_stage = "rejected"
                    auto_recommendation = "hold"                                            
                elif overall_score < HOLD_CUTOFF:
                    target_stage = "human_screening"
                    auto_recommendation = "hold"
                elif overall_score < PASS_CUTOFF:
                    target_stage = "human_screening"
                    auto_recommendation = "advance"
                else:
                    target_stage = "human_screening"
                    auto_recommendation = "pass"

                                                                                                 
                await db.applications_col.update_one(
                    {"_id": ObjectId(app_id)},
                    {
                        "$set": {
                            "interview_score": overall_score,
                            "ai_score": overall_score,
                            "last_updated": now().isoformat(),
                            "overridden_by_employer": bool(app_doc.get("overridden_by_employer", False)),
                        }
                    },
                )

                if not app_doc.get("overridden_by_employer", False):
                    stage_note = f"AI interview score {overall_score}/100 -> moved to {target_stage}"
                    stage_history = app_doc.get("stage_history", [])
                    stage_history = list(stage_history) + [{"stage": target_stage, "timestamp": now().isoformat(), "note": stage_note}]

                    await db.applications_col.update_one(
                        {"_id": ObjectId(app_id)},
                        {
                            "$set": {
                                "stage": target_stage,
                                "recommendation": auto_recommendation,
                                "recommendation_reasoning": recommendation_reasoning,
                            },
                        },
                    )
                                                                                         
                    await db.applications_col.update_one(
                        {"_id": ObjectId(app_id)},
                        {"$set": {"stage_history": stage_history}},
                    )

                    cand_user_id = app_doc.get("candidate_id", "")
                    await db.agent_activities_col.insert_one({
                        "candidate_id": cand_user_id,
                        "type": "ai_interview_evaluated",
                        "message": f"AI Interview completed: {overall_score}/100 (AI recommends {auto_recommendation}).",
                        "job_id": str(job["_id"]) if job else session.get("job_id", ""),
                        "job_title": job.get("title", "") if job else session.get("job_title", ""),
                        "timestamp": now().isoformat(),
                        "read": False,
                    })
        except Exception:
                                                                                   
            pass

    return {
        "done": True,
        "interview_report": evaluation,
        "overall_score": overall_score,
        "dimension_scores": dimension_scores,
        "notable_quotes": notable_quotes,
        "recommendation": recommendation,
        "recommendation_reasoning": recommendation_reasoning,
        "transcript": transcript,
                       
        "reviews": reviews,
        "overall_feedback": recommendation_reasoning,
        "gap_score": overall_score,
    }


@app.get("/api/candidate/mock-interview/{session_id}")
async def get_interview_session(session_id: str):
    session = await db.interview_sessions_col.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(404, "Session not found")
    return _id(session)


@app.get("/api/candidate/mock-interviews/{candidate_id}")
async def list_interview_sessions(candidate_id: str):
    cursor = db.interview_sessions_col.find({"candidate_id": candidate_id}).sort("created_at", -1)
    sessions = await cursor.to_list(50)
    return _ids(sessions)

FIXED_STAGES = ["applied", "ai_screen", "ai_interview", "human_screening", "offer"]

@app.post("/api/employer/jobs")
async def create_job(payload: JobCreate):
    employer = await db.users_col.find_one({"_id": ObjectId(payload.employer_id)})
    doc = payload.model_dump()
    doc["employer_name"] = employer["name"] if employer else payload.employer_name
    doc["status"] = "active"
    doc["created_at"] = now().isoformat()
    doc["agency_name"] = ""
    doc["agency_scope"] = ""
    doc["hitl_steps"] = []
    res = await db.jobs_col.insert_one(doc)
    job = await db.jobs_col.find_one({"_id": res.inserted_id})
    return _id(job)

DEFAULT_AI_INTERVIEW_THRESHOLDS = {
    "reject_cutoff": 60,  # score < reject_cutoff => rejected
    "hold_cutoff": 70,    # reject_cutoff <= score < hold_cutoff => hold
    "pass_cutoff": 80,    # score >= pass_cutoff => pass
}


@app.get("/api/employer/ai-interview-thresholds/{employer_id}")
async def get_ai_interview_thresholds(employer_id: str):
    doc = await db.employer_ai_interview_thresholds_col.find_one({"employer_id": employer_id})
    if not doc:
        return {"employer_id": employer_id, **DEFAULT_AI_INTERVIEW_THRESHOLDS}
    return _id(doc)


@app.put("/api/employer/ai-interview-thresholds/{employer_id}")
async def set_ai_interview_thresholds(employer_id: str, payload: dict):
    reject_cutoff = int(payload.get("reject_cutoff", DEFAULT_AI_INTERVIEW_THRESHOLDS["reject_cutoff"]))
    hold_cutoff = int(payload.get("hold_cutoff", DEFAULT_AI_INTERVIEW_THRESHOLDS["hold_cutoff"]))
    pass_cutoff = int(payload.get("pass_cutoff", DEFAULT_AI_INTERVIEW_THRESHOLDS["pass_cutoff"]))

    # Basic sanity checks for ordering and bounds.
    if not (0 <= reject_cutoff <= 100 and 0 <= hold_cutoff <= 100 and 0 <= pass_cutoff <= 100):
        raise HTTPException(400, "Thresholds must be between 0 and 100")
    if not (reject_cutoff <= hold_cutoff <= pass_cutoff):
        raise HTTPException(400, "Thresholds must satisfy reject_cutoff <= hold_cutoff <= pass_cutoff")

    update = {
        "employer_id": employer_id,
        "reject_cutoff": reject_cutoff,
        "hold_cutoff": hold_cutoff,
        "pass_cutoff": pass_cutoff,
        "updated_at": now().isoformat(),
    }
    await db.employer_ai_interview_thresholds_col.update_one(
        {"employer_id": employer_id},
        {"$set": update},
        upsert=True,
    )
    doc = await db.employer_ai_interview_thresholds_col.find_one({"employer_id": employer_id})
    return _id(doc)


@app.get("/api/employer/jobs")
async def get_employer_jobs(employer_id: str):
    cursor = db.jobs_col.find({"employer_id": employer_id}).sort("created_at", -1)
    jobs = await cursor.to_list(100)
    result = []
    for job in _ids(jobs):
        job_id = job["id"]
        try:
            counts = await _get_stage_counts(job_id)
        except Exception:
            counts = {}
        job["stage_counts"] = counts
        result.append(job)
    return result


@app.get("/api/jobs")
async def get_all_jobs():
    cursor = db.jobs_col.find({"status": "active"}).sort("created_at", -1)
    jobs = await cursor.to_list(200)
    return _ids(jobs)


@app.get("/api/employer/jobs/{job_id}")
async def get_job_detail(job_id: str):
    try:
        job = await db.jobs_col.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(400, "Invalid job_id")
    if not job:
        raise HTTPException(404, "Job not found")
    return _id(job)


@app.put("/api/employer/jobs/{job_id}")
async def update_job(job_id: str, payload: JobUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    await db.jobs_col.update_one({"_id": ObjectId(job_id)}, {"$set": update})
    job = await db.jobs_col.find_one({"_id": ObjectId(job_id)})
    return _id(job)


@app.put("/api/employer/jobs/{job_id}/agency")
async def assign_agency(job_id: str, payload: AgencyAssign):
    await db.jobs_col.update_one({"_id": ObjectId(job_id)}, {"$set": {
        "agency_name": payload.agency_name,
        "agency_scope": payload.agency_scope,
        "hitl_steps": payload.hitl_steps,
    }})
    return {"success": True}


@app.get("/api/employer/jobs/{job_id}/shortlist")
async def get_shortlist(job_id: str, limit: int = 50):
    cursor = db.applications_col.find({"job_id": job_id, "stage": {"$ne": "rejected"}}).sort("match_score", -1).limit(limit)
    apps = await cursor.to_list(limit)
    result = []
    for app in apps:
        cand = await db.users_col.find_one({"_id": ObjectId(app["candidate_id"])})
        profile = await db.candidate_profiles_col.find_one({"user_id": app["candidate_id"]})
        session = await db.interview_sessions_col.find_one({"application_id": str(app["_id"]), "status": "completed"})
        result.append({
            "application_id": str(app["_id"]),
            "candidate_id": app["candidate_id"],
            "name": cand["name"] if cand else "Unknown",
            "email": cand["email"] if cand else "",
            "match_score": app.get("match_score", 0),
            "stage": app.get("stage", "matched"),
            "skills": profile.get("skills", []) if profile else [],
            "location": profile.get("location", "") if profile else "",
            "experience_years": profile.get("experience_years", 0) if profile else 0,
            "gap_score": session.get("gap_score", 0) if session else None,
            "completed_steps": app.get("completed_steps", []),
            "feedback": app.get("feedback", {}),
        })
    return result

@app.get("/api/employer/candidate/{application_id}")
async def get_candidate_deepview(application_id: str):
    try:
        app_doc = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    except Exception:
        raise HTTPException(400, "Invalid application_id")
    if not app_doc:
        raise HTTPException(404, "Application not found")

    cand = await db.users_col.find_one({"_id": ObjectId(app_doc["candidate_id"])})
    profile = await db.candidate_profiles_col.find_one({"user_id": app_doc["candidate_id"]})
    job = await db.jobs_col.find_one({"_id": ObjectId(app_doc["job_id"])})
    sessions_cursor = db.interview_sessions_col.find({"application_id": application_id}).sort("created_at", -1)
    sessions = await sessions_cursor.to_list(10)

    latest_completed = next((s for s in sessions if s.get("status") == "completed"), None)
    latest_report = None
    if latest_completed:
        # Prefer the explicit report blob if available, otherwise derive from top-level fields.
        latest_report = latest_completed.get("interview_report") or {
            "overall_score": latest_completed.get("overall_score", 0),
            "dimension_scores": latest_completed.get("dimension_scores", {}),
            "transcript": latest_completed.get("transcript", []),
            "notable_quotes": latest_completed.get("notable_quotes", []),
            "recommendation": latest_completed.get("recommendation", "hold"),
            "recommendation_reasoning": latest_completed.get("recommendation_reasoning", ""),
        }

    override_audits_cursor = db.ai_interview_override_audit_col.find({"application_id": application_id}).sort("timestamp", -1).limit(20)
    override_audits = await override_audits_cursor.to_list(20)

    return {
        "application": {
            "id": str(app_doc["_id"]),
            "stage": app_doc.get("stage", ""),
            "match_score": app_doc.get("match_score", 0),
            "stage_history": app_doc.get("stage_history", []),
            "completed_steps": app_doc.get("completed_steps", []),
            "feedback": app_doc.get("feedback", {}),
            "parsed_data": app_doc.get("parsed_data", {}),
            "ai_score": app_doc.get("ai_score", None),
            "interview_score": app_doc.get("interview_score", None),
            "recommendation": app_doc.get("recommendation", None),
            "recommendation_reasoning": app_doc.get("recommendation_reasoning", ""),
            "overridden_by_employer": app_doc.get("overridden_by_employer", False),
        },
        "candidate": {"id": str(cand["_id"]), "name": cand["name"], "email": cand["email"]} if cand else {},
        "profile": _id(profile) if profile else {},
        "job": _id(job) if job else {},
        "latest_ai_interview_report": latest_report,
        "ai_interview_override_audits": _ids(override_audits),
        "interview_sessions": [_id(s) for s in sessions],
    }
@app.put("/api/employer/applications/{application_id}/stage")
async def update_stage(application_id: str, payload: StageUpdate):
    try:
        app_doc = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    except Exception:
        raise HTTPException(400, "Invalid application_id")
    if not app_doc:
        raise HTTPException(404, "Not found")

    history = app_doc.get("stage_history", [])
    history.append({"stage": payload.stage, "timestamp": now().isoformat(), "note": payload.note})
    await db.applications_col.update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {"stage": payload.stage, "stage_history": history}}
    )

    # Notify candidate via agent feed
    job = await db.jobs_col.find_one({"_id": ObjectId(app_doc["job_id"])})
    await db.agent_activities_col.insert_one({
        "candidate_id": app_doc["candidate_id"],
        "type": "stage_update",
        "message": f"Stage updated to '{payload.stage}' for {job['title'] if job else 'a role'}",
        "job_id": app_doc["job_id"],
        "job_title": job["title"] if job else "",
        "timestamp": now().isoformat(),
        "read": False,
    })
    return {"success": True, "stage": payload.stage}


@app.put("/api/employer/applications/{application_id}/complete-step")
async def complete_step(application_id: str, payload: StepCompletion):
    app_doc = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    if not app_doc:
        raise HTTPException(404, "Not found")
    completed = app_doc.get("completed_steps", [])
    if payload.completed and payload.step_id not in completed:
        completed.append(payload.step_id)
    elif not payload.completed and payload.step_id in completed:
        completed.remove(payload.step_id)
    await db.applications_col.update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {"completed_steps": completed}}
    )
    return {"success": True, "completed_steps": completed}


@app.post("/api/employer/applications/{application_id}/reject")
async def reject_application(application_id: str, payload: RejectApplication, employer_id: str):
    try:
        app_doc = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    except Exception:
        raise HTTPException(400, "Invalid application_id")
    if not app_doc:
        raise HTTPException(404, "Not found")

    employer = await db.users_col.find_one({"_id": ObjectId(employer_id)})
    job = await db.jobs_col.find_one({"_id": ObjectId(app_doc["job_id"])})
    history = app_doc.get("stage_history", [])
    history.append({"stage": "rejected", "timestamp": now().isoformat()})
    await db.applications_col.update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {"stage": "rejected", "stage_history": history, "rejection_message": payload.message}}
    )

    # Send rejection message to candidate inbox
    rej_msg = {
        "application_id": application_id,
        "from_id": employer_id,
        "from_name": employer["name"] if employer else "Employer",
        "to_id": app_doc["candidate_id"],
        "content": payload.message,
        "msg_type": "rejection",
        "job_title": job["title"] if job else "",
        "timestamp": now().isoformat(),
        "read": False,
    }
    rej_ins = await db.messages_col.insert_one(rej_msg)
    rej_msg["_id"] = rej_ins.inserted_id
    await emit_new_message(rej_msg)

    # Agent feed notification
    await db.agent_activities_col.insert_one({
        "candidate_id": app_doc["candidate_id"],
        "type": "rejected",
        "message": f"Application for {job['title'] if job else 'a role'} was not moved forward.",
        "job_id": app_doc.get("job_id", ""),
        "job_title": job["title"] if job else "",
        "timestamp": now().isoformat(),
        "read": False,
    })
    return {"success": True}

@app.put("/api/employer/applications/{application_id}/ai-interview/override")
async def override_ai_interview(
    application_id: str,
    payload: AiInterviewOverrideRequest,
    employer_id: str,
):
    try:
        app_doc = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    except Exception:
        raise HTTPException(400, "Invalid application_id")
    if not app_doc:
        raise HTTPException(404, "Application not found")

    job = await db.jobs_col.find_one({"_id": ObjectId(app_doc.get("job_id"))}) if app_doc.get("job_id") else None
    if job and job.get("employer_id") != employer_id:
        raise HTTPException(403, "Forbidden")

    before = {
        "interview_score": app_doc.get("interview_score", app_doc.get("ai_score", None)),
        "recommendation": app_doc.get("recommendation", None),
        "stage": app_doc.get("stage", None),
    }

    update_fields = {
        "overridden_by_employer": True,
        "last_updated": now().isoformat(),
    }

    after = dict(before)
    if payload.score is not None:
        update_fields["interview_score"] = payload.score
        update_fields["ai_score"] = payload.score
        after["interview_score"] = payload.score
    if payload.recommendation is not None:
        update_fields["recommendation"] = payload.recommendation
        after["recommendation"] = payload.recommendation
    if payload.stage is not None:
        update_fields["stage"] = payload.stage
        after["stage"] = payload.stage

    # Update application fields
    await db.applications_col.update_one({"_id": ObjectId(application_id)}, {"$set": update_fields})

    # If stage was overridden, add a stage_history entry for transparency.
    if payload.stage is not None:
        history = list(app_doc.get("stage_history", []))
        history.append({
            "stage": payload.stage,
            "timestamp": now().isoformat(),
            "note": payload.note or "Overridden by employer (AI interview HITL).",
        })
        await db.applications_col.update_one({"_id": ObjectId(application_id)}, {"$set": {"stage_history": history}})

    # Audit log entry
    await db.ai_interview_override_audit_col.insert_one({
        "application_id": application_id,
        "employer_id": employer_id,
        "candidate_id": app_doc.get("candidate_id", ""),
        "timestamp": now().isoformat(),
        "before": before,
        "after": after,
        "note": payload.note or "",
    })

    return {"success": True, "before": before, "after": after}


@app.post("/api/employer/applications/{application_id}/message")
async def employer_send_message(application_id: str, payload: MessageCreate, employer_id: str):
    app_doc = await db.applications_col.find_one({"_id": ObjectId(application_id)})
    if not app_doc:
        raise HTTPException(404, "Not found")
    employer = await db.users_col.find_one({"_id": ObjectId(employer_id)})
    job = await db.jobs_col.find_one({"_id": ObjectId(app_doc["job_id"])})
    if job and job.get("employer_id") != employer_id:
        raise HTTPException(403, "You cannot message this candidate")
    em_msg = {
        "application_id": application_id,
        "from_id": employer_id,
        "from_name": employer["name"] if employer else "Employer",
        "to_id": app_doc["candidate_id"],
        "content": payload.content,
        "msg_type": payload.msg_type,
        "job_title": job["title"] if job else "",
        "timestamp": now().isoformat(),
        "read": False,
    }
    em_ins = await db.messages_col.insert_one(em_msg)
    em_msg["_id"] = em_ins.inserted_id
    await emit_new_message(em_msg)
    return {"success": True}


@app.get("/api/employer/applications/{application_id}/messages")
async def get_application_messages(application_id: str):
    cursor = db.messages_col.find({"application_id": application_id}).sort("timestamp", 1)
    msgs = await cursor.to_list(200)
    return _ids(msgs)


async def _get_stage_counts(job_id: str) -> dict:
    stages = ["matched", "screened", "interview", "assignment", "offer", "rejected"]
    counts = {}
    for stage in stages:
        counts[stage] = await db.applications_col.count_documents({"job_id": job_id, "stage": stage})
    counts["total"] = await db.applications_col.count_documents({"job_id": job_id})
    return counts


@app.get("/api/employer/analytics/{employer_id}")
async def get_employer_analytics(employer_id: str):
    cursor = db.jobs_col.find({"employer_id": employer_id})
    jobs = await cursor.to_list(100)
    analytics = []
    for job in jobs:
        jid = str(job["_id"])
        counts = await _get_stage_counts(jid)
        analytics.append({
            "job_id": jid,
            "job_title": job["title"],
            "status": job.get("status", "active"),
            "created_at": job.get("created_at", ""),
            "stage_counts": counts,
        })
    return analytics


socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
