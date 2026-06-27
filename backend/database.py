import motor.motor_asyncio
import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env')

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("MONGODB_DB_NAME", "talent_scout_ai")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URI)
db = client[DB_NAME]

# Collections
users_col = db["users"]
candidate_profiles_col = db["candidate_profiles"]
jobs_col = db["jobs"]
applications_col = db["applications"]
agent_activities_col = db["agent_activities"]
interview_sessions_col = db["interview_sessions"]
messages_col = db["messages"]
employer_ai_interview_thresholds_col = db["employer_ai_interview_thresholds"]
ai_interview_override_audit_col = db["ai_interview_override_audit_logs"]


async def init_indexes():
    """Create indexes for performance."""
    await users_col.create_index("email", unique=True)
    await candidate_profiles_col.create_index("user_id")
    await jobs_col.create_index("employer_id")
    await applications_col.create_index([("candidate_id", 1), ("job_id", 1)])
    await agent_activities_col.create_index([("candidate_id", 1), ("timestamp", -1)])
    await messages_col.create_index([("application_id", 1), ("timestamp", 1)])
    await interview_sessions_col.create_index("application_id")
    await ai_interview_override_audit_col.create_index([("application_id", 1), ("timestamp", -1)])
    await employer_ai_interview_thresholds_col.create_index("employer_id", unique=True)
