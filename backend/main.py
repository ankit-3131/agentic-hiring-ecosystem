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



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True)
