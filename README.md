# ClassMate AI – Your Child's Personal AI Teacher

ClassMate AI is a voice-first AI-powered teaching application designed for preschool children aged 4–6 years. It transforms passive screen time into meaningful and interactive learning time.

## Problem Statement

Young children often spend considerable time watching cartoons and playing games on mobile devices. Parents may not always have enough time to teach their children after work. ClassMate AI aims to make screen time educational through personalized AI-powered teaching.

## Key Features

- AI-powered personal teacher.
- Adaptive learning with alternative explanations.
- Voice interaction with children.
- Educational stories, games and quizzes.
- Multilingual interaction.
- Alphabet and number writing practice.
- Learning assessments and tests.
- Progress tracking.

## Gnani AI Integration

ClassMate AI uses two Gnani AI technologies:

- **Prisma:** Speech-to-text technology that converts the child's spoken words into text.
- **Timbre:** Text-to-speech technology that converts the AI teacher's responses into speech.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite |
| Backend | Python, FastAPI |
| Database | SQLite and MongoDB |
| Speech-to-Text | Gnani AI Prisma |
| Text-to-Speech | Gnani AI Timbre |

## Project Structure

```text
ClassMate-AI/
├── backend/
│   ├── app/
│   ├── curriculum/
│   ├── scripts/
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Installation

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

Open another terminal:

```bash
cd ClassMate-AI/frontend
npm install
npm run dev
```

Open the local URL provided by Vite in your browser.

## Project Goal

To make early childhood education more accessible, interactive and personalized through voice-based artificial intelligence.

**ClassMate AI – Not just screen time, but learning time!**
