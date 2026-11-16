from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.curriculum import router as curriculum_router
from app.database import initialize_database
from app.routes.auth import router as auth_router
from app.routes.children import router as children_router
from app.routes.progress import router as progress_router
from app.routes.voice import router as voice_router
from app.routes.prisma import router as prisma_router
from app.routes.teacher import router as gemini_teacher_router
from app.routes.session import router as session_router

app = FastAPI(
    title="ClassMate AI",
    description="An adaptive AI teacher powered by Gemini and Gnani AI",
    version="2.0.0"
)

import os

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        FRONTEND_URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    initialize_database()


app.include_router(auth_router)
app.include_router(children_router)
app.include_router(progress_router)
app.include_router(voice_router)
app.include_router(prisma_router)
app.include_router(gemini_teacher_router)
app.include_router(session_router)
app.include_router(curriculum_router)


@app.get("/")
def home():
    return {
        "message": "Welcome to ClassMate AI!",
        "status": "Backend running successfully"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "project": "ClassMate AI"
    }


@app.get("/api/teacher")
def teacher():
    return {
        "teacher_name": "ClassMate AI Teacher",
        "age_group": "4-8 years",
        "capabilities": [
            "Alphabet teaching",
            "Adaptive learning",
            "Storytelling",
            "General knowledge",
            "Voice interaction",
            "Writing practice",
            "AI-powered question answering",
            "Continuous teaching sessions",
            "Learning progress and session resume"
        ]
    }
