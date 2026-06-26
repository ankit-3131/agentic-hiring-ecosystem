from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str


class ConsentSettings(BaseModel):
    share_profile: bool = True
    agent_active: bool = True
    salary_visible: bool = True
    agency_visible: bool = True

class CandidateProfileCreate(BaseModel):
    user_id: str
    current_role: str = ""
    experience_years: float = 0
    notice_period: str = "30 days"
    location: str = ""
    salary_min: float = 0
    salary_max: float = 0
    skills: List[str] = []
    resume_text: str = ""
    resume_filename: str = ""
    summary: str = ""
    projects: str = ""
    achievements: List[str] = []
    experience: List[Dict[str, Any]] = []
    education: List[Dict[str, Any]] = []
    parsed_resume: Dict[str, Any] = Field(default_factory=dict)
    consent: ConsentSettings = Field(default_factory=ConsentSettings)

class CandidateProfileUpdate(BaseModel):
    current_role: Optional[str] = None
    experience_years: Optional[float] = None
    notice_period: Optional[str] = None
    location: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    skills: Optional[List[str]] = None
    resume_text: Optional[str] = None
    resume_filename: Optional[str] = None
    summary: Optional[str] = None
    projects: Optional[str] = None
    achievements: Optional[List[str]] = None
    experience: Optional[List[Dict[str, Any]]] = None
    education: Optional[List[Dict[str, Any]]] = None
    parsed_resume: Optional[Dict[str, Any]] = None

class ConsentUpdate(BaseModel):
    share_profile: Optional[bool] = None
    agent_active: Optional[bool] = None
    salary_visible: Optional[bool] = None
    agency_visible: Optional[bool] = None


FIXED_WORKFLOW_STAGES = ["applied", "ai_screen", "ai_interview", "human_screening", "offer"]

class JobCreate(BaseModel):
    title: str
    description: str
    employer_id: str
    employer_name: str = ""
    location: str = ""
    salary_min: float = 0
    salary_max: float = 0
    employment_type: str = "Full-time"

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None

class AgencyAssign(BaseModel):
    agency_name: str
    agency_scope: str
    hitl_steps: List[str] = []


class StageUpdate(BaseModel):
    stage: str
    note: str = ""

class RejectApplication(BaseModel):
    message: str

class StepCompletion(BaseModel):
    step_id: str
    completed: bool


class MessageCreate(BaseModel):
    content: str
    msg_type: str = "message"


class InterviewStart(BaseModel):
    application_id: str
    candidate_id: str

class AnswerSubmit(BaseModel):
    answer: str


class AiInterviewTranscriptItem(BaseModel):
    question: str
    answer: str
    timestamp: str = ""


class AiInterviewDimensionScores(BaseModel):
    communication_clarity: int = 0
    technical_depth: int = 0
    problem_solving_approach: int = 0
    cultural_signals: int = 0


class AiInterviewNotableQuote(BaseModel):
    quote: str
    dimension: str = ""
    why_it_matters: str = ""


class AiInterviewReport(BaseModel):
    overall_score: int = 0
    dimension_scores: AiInterviewDimensionScores = Field(default_factory=AiInterviewDimensionScores)
    transcript: List[AiInterviewTranscriptItem] = Field(default_factory=list)
    notable_quotes: List[AiInterviewNotableQuote] = Field(default_factory=list)
    recommendation: str = "hold"
    recommendation_reasoning: str = ""


class EmployerAiInterviewThresholds(BaseModel):
    reject_cutoff: int = 60
    hold_cutoff: int = 70
    pass_cutoff: int = 80


class AiInterviewOverrideRequest(BaseModel):
    score: Optional[int] = None
    recommendation: Optional[str] = None
    stage: Optional[str] = None
    note: Optional[str] = None


class ApplyRequest(BaseModel):
    candidate_id: str
    job_id: str

class ApplicationStage(BaseModel):
    stage: str
    timestamp: Optional[str] = None

class ApplicationCreate(BaseModel):
    candidate_id: str
    job_id: str
    stage: str = "matched"
    match_score: float = 0
    feedback: Optional[Dict[str, Any]] = None
    resume_text: Optional[str] = None
    parsed_data: Optional[Dict[str, Any]] = None
    stage_history: List[ApplicationStage] = Field(default_factory=list)
    completed_steps: List[Any] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ApplicationOut(ApplicationCreate):
    id: str