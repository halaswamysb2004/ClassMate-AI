import json

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.database import get_connection
from app.routes.auth import get_current_parent

router = APIRouter(
    prefix="/api/progress",
    tags=["Learning Progress"]
)


class ProgressUpdate(BaseModel):
    completed: int = Field(ge=0, le=6)
    total: int = Field(default=6, ge=1, le=6)
    answers: int = Field(ge=0)
    correct: int = Field(ge=0)
    activities: list[str] = []


@router.post("/{child_id}")
def save_progress(
    child_id: int,
    data: ProgressUpdate,
    parent=Depends(get_current_parent)
):
    if data.correct > data.answers:
        raise HTTPException(
            status_code=400,
            detail="Correct answers cannot exceed total answers."
        )

    if data.completed > data.total:
        raise HTTPException(
            status_code=400,
            detail="Completed activities cannot exceed total activities."
        )

    percentage = (
        round((data.correct / data.answers) * 100)
        if data.answers else 0
    )

    connection = get_connection()

    child = connection.execute(
        "SELECT id FROM children WHERE id = ? AND parent_id = ?",
        (child_id, parent["id"])
    ).fetchone()

    if not child:
        connection.close()
        raise HTTPException(
            status_code=404,
            detail="Child profile not found."
        )

    connection.execute(
        """
        INSERT INTO child_progress (
            child_id, parent_id, completed, total,
            answers, correct, percentage, activities,
            last_session
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)

        ON CONFLICT(child_id) DO UPDATE SET
            parent_id = excluded.parent_id,
            completed = excluded.completed,
            total = excluded.total,
            answers = excluded.answers,
            correct = excluded.correct,
            percentage = excluded.percentage,
            activities = excluded.activities,
            last_session = CURRENT_TIMESTAMP
        """,
        (
            child_id,
            parent["id"],
            data.completed,
            data.total,
            data.answers,
            data.correct,
            percentage,
            json.dumps(data.activities)
        )
    )

    connection.commit()
    connection.close()

    return {
        "message": "Learning progress saved successfully.",
        "child_id": child_id,
        "completed": data.completed,
        "total": data.total,
        "answers": data.answers,
        "correct": data.correct,
        "percentage": percentage
    }


@router.get("/{child_id}")
def get_progress(
    child_id: int,
    parent=Depends(get_current_parent)
):
    connection = get_connection()

    result = connection.execute(
        """
        SELECT completed, total, answers, correct,
               percentage, activities, last_session
        FROM child_progress
        WHERE child_id = ? AND parent_id = ?
        """,
        (child_id, parent["id"])
    ).fetchone()

    connection.close()

    if not result:
        return {
            "child_id": child_id,
            "completed": 0,
            "total": 6,
            "answers": 0,
            "correct": 0,
            "percentage": 0,
            "activities": [],
            "last_session": None
        }

    data = dict(result)
    data["activities"] = json.loads(data["activities"] or "[]")

    return {
        "child_id": child_id,
        **data
    }
