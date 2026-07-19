# Agentic Hiring Ecosystem

> Apply once. Hire smarter. Let AI agents coordinate the rest.

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge)](https://ai-hiring-pvt.vercel.app/)

https://ai-hiring-pvt.vercel.app/
 (You can also login through demo accounts of employer and candidate)

An agentic hiring platform where AI agents—not job boards—connect candidates, companies, agencies, and hiring tools in a single ecosystem. Candidates apply once to create a persistent AI profile that matches them across all connected employers. Every job creates its own AI agent that coordinates candidate discovery, screening, interviews, and hiring through configurable workflows.

## 🌟 Key Features

### 🤖 AI-Powered Agent System
- **AI Resume Screening Agent**: Automatically parses resumes and scores candidates against job descriptions thorugh resume parser agent
- **AI Interview Agent**: Conducts adaptive, conversational interviews with follow-up questions based on candidate responses
- **AI Interview Evaluation Agent**: Provides structured feedback with dimensional scoring and hiring recommendations
- **Skill Gap Analysis Agent**: Identifies skill gaps and provides personalized learning recommendations
- **Agent Activity Feed**: Persistent AI coach that provides insights and guidance throughout the hiring journey

### 👥 Multi-Role Platform
- **Candidates**: Create persistent AI profiles, apply once to multiple jobs, get AI-powered interview prep
- **Employers**: Post jobs, review AI-screened candidates, conduct AI interviews, make data-driven hiring decisions
- **Administrators**: Manage users, monitor system analytics, configure system-wide settings

### 🔄 Intelligent Workflow Automation
- **Application Pipeline**: Applied → AI Screening → AI Interview → Human Screening → Offer
- **Adaptive Interviewing**: AI adapts questions based on candidate responses in real-time
- **Smart Matching**: Persistent candidate profiles get continuously matched with new job postings
- **HITL (Human-in-the-Loop)**: Employers can override AI decisions at any stage

### 💬 Integrated Communication
- **In-App Messaging**: Secure communication between candidates and employers
- **Interview Transcripts**: Complete record of AI interviews with timestamps and analysis
- **Agent Notifications**: Proactive updates on application status, interview scheduling, and feedback
- **Real-time Updates**: Socket.io-powered live updates for seamless communication

### 📊 Analytics & Insights
- **Employer Analytics**: Track job performance, pipeline metrics, and hiring efficiency
- **Skill Gap Reports**: Personalized development recommendations for candidates
- **Interview Analytics**: Detailed breakdown of interview performance by competency
- **Application Tracking**: Real-time visibility into application status and stage progression

### Proper API Documentation through Redoc
<img width="1902" height="887" alt="image" src="https://github.com/user-attachments/assets/b333d9d6-a2fc-4c28-ab57-069ae4a9d34f" />



# Screenshots from the webapp:
<img width="1487" height="772" alt="image" src="https://github.com/user-attachments/assets/59c26d4a-968a-4ca3-83b9-96eb7ba99fc8" />

<img width="1917" height="866" alt="image" src="https://github.com/user-attachments/assets/a77ca502-1ec0-4dbf-816c-e1b7de44adef" />
<img width="1867" height="793" alt="image" src="https://github.com/user-attachments/assets/2688a0ea-7725-4234-a094-0122cd89a2b4" />
<img width="1690" height="797" alt="image" src="https://github.com/user-attachments/assets/40613816-19d5-4c9b-8de3-5f51ff9eff5a" />

## 🏗️ Architecture

### Frontend
- **React 18** with **TypeScript**
- **Vite** for fast development and building
- **Tailwind CSS** for responsive, modern UI
- **Socket.io-client** for real-time communication
- **React Hot Toast** for notifications
- **Framer Motion** for animations
- **Lucide React** for icons

### Backend
- **FastAPI** for high-performance API endpoints
- **MongoDB** for flexible, scalable data storage
- **Socket.io** for real-time event Handling
- **Google Gemini AI** (via LangChain) for all AI capabilities
- **LangGraph** for orchestrating AI agent workflows
- **Pydantic** for data validation and serialization

### AI Agents
The platform utilizes specialized AI agents built with LangChain and LangGraph:

1. **Resume Parsing Agent**: Extracts structured data from resumes/CVs
2. **Resume Scoring Agent**: Evaluates candidate-job fit with detailed reasoning
3. **Interview Question Generator**: Creates adaptive interview questions
4. **Interview Evaluator**: Provides structured feedback and hiring recommendations
5. **Skill Gap Analyzer**: Identifies development areas and learning recommendations

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- MongoDB instance
- Google Gemini API key

### Installation

#### Backend Setup
```bash
Clone the repository

cd agentic-hiring-ecosystem

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env to add your MongoDB URI and Gemini API key

# Start the server
uvicorn main:socket_app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend Setup
```bash
# Install Node.js dependencies
cd ..
npm install

# Set up environment variables
cp .env.example .env
# Edit .env to add your VITE_GEMINI_API_KEY and VITE_API_URL

# Start the development server
npm run dev
```

### Environment Variables

#### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/talent_scout
GEMINI_API_KEY=your_google_gemini_api_key
```

#### Frontend (.env)
```env
VITE_GEMINI_API_KEY=your_google_gemini_api_key
VITE_API_URL=http://localhost:8000
```

## 📚 API Documentation

Once the server is running, visit:
- **UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/api/health

## 🧠 How It Works

### For Candidates
1. **Create Profile**: Build your persistent AI profile with resume upload
2. **AI Matching**: Your profile gets matched with relevant job postings
3. **Apply Once**: Apply to multiple jobs with a single click
4. **AI Screening**: Get instant feedback on your application fit
5. **Adaptive Interviewing**: Practice with AI that adapts to your responses
6. **Skill Development**: Receive personalized learning recommendations
7. **Application Tracking**: Track your progress through each hiring stage

### For Employers
1. **Post Jobs**: Create detailed job descriptions with required skills
2. **AI Screening**: Automatically screen incoming applications
3. **Review Candidates**: View AI-generated insights and recommendations
4. **Conduct Interviews**: Use AI interviewers or conduct your own
5. **Make Decisions**: Leverage AI recommendations while maintaining final authority
6. **Build Talent Pool**: Maintain relationships with promising candidates

## 🔒 Security & Privacy

- **Data Encryption**: All sensitive data encrypted at rest and in transit
- **Role-Based Access**: Granular permissions based on user roles
- **Input Validation**: Strict validation on all API endpoints


*"Transforming hiring from a transactional process to a relationship-driven journey powered by intelligent AI agents."*
