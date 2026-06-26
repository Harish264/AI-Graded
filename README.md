# GradeAI — AI Grading & Feedback Engine

Production-ready full-stack application for AI-powered grading at Indian universities.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL 16 |
| AI Grading | Anthropic Claude (claude-sonnet-4-6) |
| OCR | Tesseract (local) or Google Vision API |
| Auth | JWT + bcrypt |

## Quick Start (Docker)

```bash
# 1. Copy env file and add your keys
cp backend/.env.example backend/.env
# Edit backend/.env — add ANTHROPIC_API_KEY

# 2. Start everything
docker compose up --build

# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API docs: http://localhost:8000/docs
```

## Local Development (No Docker)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Create PostgreSQL DB named 'gradeai'
cp .env.example .env         # fill in your values

uvicorn app.main:app --reload
# → http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## Key Features

- **Rubric builder** — define criteria + marks once, reuse across semesters
- **Typed + handwritten submission** — OCR converts scan to text
- **AI grading** — Claude grades per criterion with confidence score
- **Human-in-the-loop approval** — nothing publishes without faculty sign-off
- **Override flow** — edit score/feedback before approving
- **Publish gate** — students only see grades after faculty publishes
- **Concept heatmap** — see which topics the class struggled with
- **AI–human agreement tracking** — bias monitoring built in
- **Full audit log** — every AI suggestion vs. human decision recorded

## User Roles

| Role | Access |
|---|---|
| `faculty` | Create assignments, review AI grades, publish results, view analytics |
| `hod` | Same as faculty + department-level view |
| `student` | Submit answers, view published grades + feedback |
| `admin` | Full access |

## API Docs

Interactive Swagger UI: `http://localhost:8000/docs`

## Environment Variables

See `backend/.env.example` for all variables.
Required: `ANTHROPIC_API_KEY`, `SECRET_KEY`, `DATABASE_URL`
