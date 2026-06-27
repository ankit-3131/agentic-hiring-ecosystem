from typing import TypedDict, Annotated, Dict, Any, List, Tuple
import operator
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage
import os, json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / '.env')

_api_key = os.environ.get("VITE_GEMINI_API_KEY", "")

_llm = None


def get_llm():
    global _llm
    if _llm is None:
        print("No llm was found! connecting one soon")
        from langchain_google_genai import ChatGoogleGenerativeAI
        _llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=_api_key)
    return _llm


def _clean_json(text: str) -> str:
    text = text.strip()
    for prefix in ("```json", "```"):
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


# ═══════════════════════════════════════
# RESUME SCREENING WORKFLOW (LangGraph)
# ═══════════════════════════════════════
class AgentState(TypedDict):
    resume_text: str
    job_description: str
    parsed_data: Dict[str, Any]
    scoring_result: Dict[str, Any]
    errors: list
    messages: Annotated[list, operator.add]


def parse_node(state: AgentState) -> AgentState:
    if not state.get("resume_text"):
        return {**state, "errors": state.get("errors", []) + ["No resume text provided"]}
    prompt = f"""Extract the following information from the resume text and return ONLY valid JSON.
Fields: name, email, phone, summary, skills (array of strings),
experience (string summary of work experience),
education (string summary of education),
projects (array of objects with title, description, metrics),
achievements (array of short strings).

RESUME:
{state['resume_text'][:15000]}

Return only the JSON object, no markdown, no explanation."""
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        parsed = json.loads(_clean_json(response.content))
        return {**state, "parsed_data": parsed}
    except Exception as e:
        return {**state, "errors": state.get("errors", []) + [f"Parsing failed: {str(e)}"]}


def score_node(state: AgentState) -> AgentState:
    if state.get("errors"):
        return state
    prompt = f"""Score the following resume against the job description.
Return ONLY valid JSON with fields: score (number 0-100), strengths (string), weaknesses (string), reasoning (string).

JOB DESCRIPTION: {state['job_description']}
RESUME DATA: {json.dumps(state['parsed_data'], indent=2)}

Return only the JSON object, no markdown, no explanation."""
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        scored = json.loads(_clean_json(response.content))
        print("Score_node ran in agent_workflow")
        return {**state, "scoring_result": scored}
    except Exception as e:
        return {**state, "errors": state.get("errors", []) + [f"Scoring failed: {str(e)}"]}


_workflow = StateGraph(AgentState)
_workflow.add_node("parse_resume", parse_node)
_workflow.add_node("score_candidate", score_node)
_workflow.set_entry_point("parse_resume")
_workflow.add_edge("parse_resume", "score_candidate")
_workflow.add_edge("score_candidate", END)
compiled_app = _workflow.compile()


async def run_resume_screening(resume_text: str, job_description: str) -> AgentState:
    initial: AgentState = {
        "resume_text": resume_text,
        "job_description": job_description,
        "parsed_data": {},
        "scoring_result": {},
        "errors": [],
        "messages": [],
    }
    return await compiled_app.ainvoke(initial)


async def run_resume_parsing(resume_text: str) -> AgentState:
    state: AgentState = {
        "resume_text": resume_text,
        "job_description": "",
        "parsed_data": {},
        "scoring_result": {},
        "errors": [],
        "messages": [],
    }
    parsed_state = parse_node(state)
    return parsed_state


# ═══════════════════════════════════════
# MOCK INTERVIEW FUNCTIONS
# ═══════════════════════════════════════
async def generate_interview_questions(job_title: str, job_description: str, count: int = 5) -> List[str]:
    prompt = f"""You are a senior technical interviewer. Generate exactly {count} interview questions for the following role.
The questions should test both technical depth and problem-solving ability. Mix conceptual and practical questions.

Role: {job_title}
Job Description: {job_description}

Return ONLY a valid JSON array of {count} question strings. No preamble, no markdown, just the JSON array.
Example: ["Question 1?", "Question 2?", ...]"""
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        questions = json.loads(_clean_json(response.content))
        if isinstance(questions, list):
            return questions[:count]
        return [f"Tell me about your experience with {job_title}", "Describe a challenging technical problem you solved",
                "How do you approach system design?", "What are your strongest technical skills?", "Where do you see yourself growing?"]
    except Exception as e:
        print(f"Question generation failed: {e}")
        return [f"Tell me about your experience with {job_title}", "Describe a challenging technical problem you solved",
                "How do you approach system design?", "What are your strongest technical skills?", "Where do you see yourself growing?"]


async def review_interview_answers(
    questions: List[str], answers: List[str], job_title: str
) -> Tuple[List[Dict], str, int]:
    """Review all answers and return per-question feedback + overall + gap_score."""
    qa_pairs = "\n\n".join(
        f"Q{i+1}: {q}\nA{i+1}: {a}" for i, (q, a) in enumerate(zip(questions, answers))
    )
    prompt = f"""You are a senior technical interviewer reviewing a mock interview for the role: {job_title}.

Review each answer carefully. For each question-answer pair, provide:
- "correct": true if the answer demonstrates solid understanding, false otherwise
- "review": a detailed 2-4 sentence review explaining what was right, what was wrong, and what a better answer would include
- "score": 0-100 rating for this specific answer

Also provide:
- "overall_feedback": 3-5 sentences summarising the candidate's overall performance, key strengths, and areas to improve
- "gap_score": a single number 0-100 representing how ready they are for this role (100 = ready to hire)

INTERVIEW:
{qa_pairs}

Return ONLY valid JSON in this exact structure:
{{
  "reviews": [
    {{"question": "...", "answer": "...", "correct": true/false, "score": 0-100, "review": "..."}},
    ...
  ],
  "overall_feedback": "...",
  "gap_score": 0-100
}}"""
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        data = json.loads(_clean_json(response.content))
        reviews = data.get("reviews", [])
        overall = data.get("overall_feedback", "Interview completed.")
        gap_score = data.get("gap_score", 50)
        return reviews, overall, gap_score
    except Exception as e:
        print(f"Review failed: {e}")
        fallback = [{"question": q, "answer": a, "correct": True, "score": 70, "review": "Answer noted."} for q, a in zip(questions, answers)]
        return fallback, "Interview completed. Please review your answers above.", 60


# ═══════════════════════════════════════
# CONVERSATIONAL AI INTERVIEW (Adaptive)
# ═══════════════════════════════════════
def _format_transcript(questions: List[str], answers: List[str], timestamps: List[str] | None = None) -> str:
    timestamps = timestamps or []
    parts: List[str] = []
    for i, (q, a) in enumerate(zip(questions, answers)):
        ts = timestamps[i] if i < len(timestamps) else ""
        ts_part = f" (timestamp: {ts})" if ts else ""
        parts.append(f"Q{i+1}:{ts_part} {q}\nA{i+1}:{ts_part} {a}")
    return "\n\n".join(parts).strip()


async def generate_next_interview_question(
    job_title: str,
    job_description: str,
    persona: str,
    questions: List[str],
    answers: List[str],
    timestamps: List[str],
    next_question_index: int,
    max_questions: int = 7,
) -> Dict[str, Any]:
    """
    Generates the next interview question adaptively.
    Returns JSON: { "question": string, "should_end": boolean }
    """
    transcript = _format_transcript(questions, answers, timestamps)
    prompt = f"""You are an AI interviewer conducting a conversational interview.
Persona: {persona}
Role: {job_title}
Max questions: {max_questions}
Next question number (1-indexed): {next_question_index + 1}

Job description:
{job_description}

Conversation so far (Q/A): 
{transcript if transcript else "(none yet)"}

Instructions:
1. Ask exactly ONE next question.
2. Make it adaptive: use follow-ups if the candidate's last answer missed an important skill dimension.
3. Cover the dimensions over time: communication_clarity, technical_depth, problem_solving_approach, cultural_signals.
4. If you have enough evidence to evaluate, set should_end=true; otherwise should_end=false.
5. The question must be short and conversational, but still rigorous.

Return ONLY valid JSON in this structure:
{{
  "question": "...",
  "should_end": true/false
}}"""
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        data = json.loads(_clean_json(response.content))
        question = data.get("question", "").strip()
        should_end = bool(data.get("should_end", False))
        if not question:
            raise ValueError("Empty question")
        return {"question": question, "should_end": should_end}
    except Exception as e:
        # Fallback keeps the system moving even if the LLM call fails.
        fallback_q = "Can you describe a specific technical challenge you solved and how you approached it?"
        return {"question": fallback_q, "should_end": next_question_index + 1 >= max_questions}


async def evaluate_interview_transcript(
    job_title: str,
    job_description: str,
    persona: str,
    questions: List[str],
    answers: List[str],
    timestamps: List[str],
) -> Dict[str, Any]:
    """
    Evaluates an interview and returns a structured employer report.
    Returns JSON with:
    - overall_score (0-100)
    - dimension_scores {communication_clarity, technical_depth, problem_solving_approach, cultural_signals}
    - transcript[]: {question, answer, timestamp}
    - notable_quotes[]: {quote, dimension, why_it_matters}
    - recommendation: advance|hold|pass
    - recommendation_reasoning: string
    """
    transcript = _format_transcript(questions, answers, timestamps)
    transcript_pairs = [
        {"question": q, "answer": a, "timestamp": (timestamps[i] if i < len(timestamps) else "")}
        for i, (q, a) in enumerate(zip(questions, answers))
    ]

    prompt = f"""You are a meticulous hiring interviewer and evaluator.
You will review a candidate's conversational interview for the role below.

Persona (used during interview): {persona}
Role: {job_title}
Job description:
{job_description}

Transcript:
{transcript if transcript else "(no responses)"}

Evaluation requirements:
1. Produce a single overall_score (0-100).
2. Provide scores for these dimensions (each 0-100):
   - communication_clarity
   - technical_depth
   - problem_solving_approach
   - cultural_signals
3. Identify strengths and weaknesses implicitly through dimension scores.
4. Extract notable quotes:
   - Provide 3-6 quotes (strings) copied from the candidate's answers.
   - For each quote include:
     - dimension: one of the 4 dimension keys
     - why_it_matters: 1-2 sentences explaining importance
5. Provide an AI hiring recommendation:
   - advance (strong)
   - hold (borderline/needs more review)
   - pass (excellent fit)
   Use overall_score to decide the label.
6. recommendation_reasoning must be 3-6 sentences referencing dimensions and notable quotes.

Return ONLY valid JSON in this structure:
{{
  "overall_score": 0-100,
  "dimension_scores": {{
    "communication_clarity": 0-100,
    "technical_depth": 0-100,
    "problem_solving_approach": 0-100,
    "cultural_signals": 0-100
  }},
  "transcript": {json.dumps(transcript_pairs, ensure_ascii=False)},
  "notable_quotes": [
    {{
      "quote": "...",
      "dimension": "communication_clarity|technical_depth|problem_solving_approach|cultural_signals",
      "why_it_matters": "..."
    }}
  ],
  "recommendation": "advance|hold|pass",
  "recommendation_reasoning": "..."
}}
"""
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        data = json.loads(_clean_json(response.content))
        # Normalize the recommendation field in case the model returns unexpected casing.
        rec = str(data.get("recommendation", "")).lower().strip()
        if rec not in {"advance", "hold", "pass"}:
            data["recommendation"] = "hold"
        return data
    except Exception as e:
        # Conservative fallback: map older gap_score-style evaluation into the new structure.
        overall = 50
        dim = {
            "communication_clarity": 50,
            "technical_depth": 50,
            "problem_solving_approach": 50,
            "cultural_signals": 50,
        }
        return {
            "overall_score": overall,
            "dimension_scores": dim,
            "transcript": transcript_pairs,
            "notable_quotes": [],
            "recommendation": "hold",
            "recommendation_reasoning": "Interview evaluation failed due to an AI error; please review the transcript manually.",
        }


# ═══════════════════════════════════════
# SKILL GAP ANALYSIS
# ═══════════════════════════════════════
async def compute_skill_gap(candidate_skills: List[str], job_descriptions: List[Dict]) -> Dict:
    jd_text = "\n\n".join(f"Role: {j['title']}\nDescription: {j['description']}" for j in job_descriptions)
    skills_str = ", ".join(candidate_skills) if candidate_skills else "None listed"
    prompt = f"""You are a career coach analyzing skill gaps.

Candidate's current skills: {skills_str}

Target roles and their descriptions:
{jd_text}

Analyze the gap and return ONLY valid JSON in this structure:
{{
  "gaps": [
    {{"skill": "skill name", "candidate_level": "None/Basic/Moderate/Strong", "required_level": "Basic/Moderate/Strong/Expert", "priority": "High/Medium/Low", "is_gap": true/false}},
    ...
  ],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "overall_readiness": 0-100
}}

Include at least 8 skills that are relevant to the target roles. Be accurate about gaps."""
    try:
        response = get_llm().invoke([HumanMessage(content=prompt)])
        return json.loads(_clean_json(response.content))
    except Exception as e:
        print(f"Skill gap analysis failed: {e}")
        return {
            "gaps": [{"skill": s, "candidate_level": "Moderate", "required_level": "Strong", "priority": "Medium", "is_gap": False} for s in candidate_skills[:5]],
            "recommendations": ["Continue developing your current skills", "Explore adjacent technologies"],
            "overall_readiness": 60,
        }
