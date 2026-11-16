import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.database import get_connection
from app.routes.auth import get_current_parent

router = APIRouter(prefix="/api/sessions", tags=["AI Teaching Sessions"])

CURRICULUM = [
    {"id": "greeting", "title": "Greeting and Warm-up"},
    {"id": "alphabet", "title": "Alphabet Learning"},
    {"id": "numbers", "title": "Number Learning"},
    {"id": "colours", "title": "Colour Learning"},
    {"id": "animals", "title": "Animal Learning"},
    {"id": "games", "title": "Educational Games"},
    {"id": "stories", "title": "Story Time"},
    {"id": "knowledge", "title": "General Knowledge"},
    {"id": "writing", "title": "Writing Practice"},
    {"id": "quiz", "title": "Knowledge Quiz"},
    {"id": "assessment", "title": "Final Assessment"},
    {"id": "goodbye", "title": "Appreciation and Goodbye"}
]


class CheckpointUpdate(BaseModel):
    current_activity_index: int = Field(ge=0, le=11)
    current_topic: str = Field(min_length=1, max_length=100)
    completed_activities: list[str] = []
    attempts: int = Field(default=0, ge=0)
    answers: int = Field(default=0, ge=0)
    correct_answers: int = Field(default=0, ge=0)
    topics_to_review: list[str] = []
    last_teacher_message: str = Field(default="", max_length=1000)


def get_child(connection, child_id, parent_id):
    child = connection.execute(
        """
        SELECT id, name, age, language, learning_level
        FROM children
        WHERE id = ? AND parent_id = ?
        """,
        (child_id, parent_id)
    ).fetchone()

    if not child:
        raise HTTPException(status_code=404, detail="Child profile not found.")

    return dict(child)


def format_session(row):
    result = dict(row)
    result["session_data"] = json.loads(result["session_data"] or "{}")
    result["curriculum"] = CURRICULUM
    return result


@router.post("/start/{child_id}")
def start_or_resume(child_id: int, parent=Depends(get_current_parent)):
    connection = get_connection()

    try:
        child = get_child(connection, child_id, parent["id"])

        existing = connection.execute(
            """
            SELECT * FROM learning_sessions
            WHERE child_id = ? AND parent_id = ?
            AND status IN ('active', 'paused')
            ORDER BY updated_at DESC, id DESC LIMIT 1
            """,
            (child_id, parent["id"])
        ).fetchone()

        if existing:
            connection.execute(
                """
                UPDATE learning_sessions
                SET status = 'active', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (existing["id"],)
            )
            connection.commit()

            row = connection.execute(
                "SELECT * FROM learning_sessions WHERE id = ?",
                (existing["id"],)
            ).fetchone()

            return {
                "message": "Previous class resumed.",
                "resumed": True,
                "child": child,
                "session": format_session(row)
            }

        initial_data = {
            "completed_activities": [],
            "attempts": 0,
            "answers": 0,
            "correct_answers": 0,
            "topics_to_review": [],
            "last_teacher_message": ""
        }

        cursor = connection.execute(
            """
            INSERT INTO learning_sessions (
                child_id, parent_id, status,
                current_activity_index, current_topic, session_data
            )
            VALUES (?, ?, 'active', 0, 'greeting', ?)
            """,
            (child_id, parent["id"], json.dumps(initial_data))
        )

        connection.commit()

        row = connection.execute(
            "SELECT * FROM learning_sessions WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        return {
            "message": "New teaching session started.",
            "resumed": False,
            "child": child,
            "session": format_session(row)
        }
    finally:
        connection.close()


@router.get("/current/{child_id}")
def current_session(child_id: int, parent=Depends(get_current_parent)):
    connection = get_connection()

    try:
        get_child(connection, child_id, parent["id"])

        row = connection.execute(
            """
            SELECT * FROM learning_sessions
            WHERE child_id = ? AND parent_id = ?
            AND status IN ('active', 'paused')
            ORDER BY updated_at DESC, id DESC LIMIT 1
            """,
            (child_id, parent["id"])
        ).fetchone()

        if not row:
            return {"has_session": False, "session": None}

        return {"has_session": True, "session": format_session(row)}
    finally:
        connection.close()


@router.patch("/{session_id}/checkpoint")
def save_checkpoint(
    session_id: int,
    data: CheckpointUpdate,
    parent=Depends(get_current_parent)
):
    if data.correct_answers > data.answers:
        raise HTTPException(
            status_code=400,
            detail="Correct answers cannot exceed total answers."
        )

    connection = get_connection()

    try:
        row = connection.execute(
            """
            SELECT * FROM learning_sessions
            WHERE id = ? AND parent_id = ?
            """,
            (session_id, parent["id"])
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Session not found.")

        if row["status"] == "completed":
            raise HTTPException(status_code=409, detail="Session already completed.")

        session_data = json.loads(row["session_data"] or "{}")
        session_data.update({
            "completed_activities": list(dict.fromkeys(data.completed_activities)),
            "attempts": data.attempts,
            "answers": data.answers,
            "correct_answers": data.correct_answers,
            "topics_to_review": list(dict.fromkeys(data.topics_to_review)),
            "last_teacher_message": data.last_teacher_message
        })

        connection.execute(
            """
            UPDATE learning_sessions
            SET current_activity_index = ?,
                current_topic = ?,
                session_data = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                data.current_activity_index,
                data.current_topic,
                json.dumps(session_data),
                session_id
            )
        )

        completed = len(session_data["completed_activities"])
        percentage = (
            round(data.correct_answers / data.answers * 100)
            if data.answers else 0
        )

        connection.execute(
            """
            INSERT INTO child_progress (
                child_id, parent_id, completed, total,
                answers, correct, percentage, activities, last_session
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
                row["child_id"], parent["id"], completed,
                len(CURRICULUM), data.answers, data.correct_answers,
                percentage, json.dumps(session_data["completed_activities"])
            )
        )

        connection.commit()

        return {
            "message": "Teaching progress saved.",
            "session_id": session_id,
            "completed_activities": completed,
            "total_activities": len(CURRICULUM),
            "accuracy": percentage
        }
    finally:
        connection.close()


@router.post("/{session_id}/pause")
def pause_session(session_id: int, parent=Depends(get_current_parent)):
    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            UPDATE learning_sessions
            SET status = 'paused', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND parent_id = ? AND status = 'active'
            """,
            (session_id, parent["id"])
        )
        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Active session not found.")

        return {"message": "Class paused. Progress is saved."}
    finally:
        connection.close()


@router.post("/{session_id}/complete")
def complete_session(session_id: int, parent=Depends(get_current_parent)):
    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            UPDATE learning_sessions
            SET status = 'completed',
                current_topic = 'completed',
                updated_at = CURRENT_TIMESTAMP,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND parent_id = ?
            AND status IN ('active', 'paused')
            """,
            (session_id, parent["id"])
        )
        connection.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Unfinished session not found.")

        return {"message": "Teaching session completed."}
    finally:
        connection.close()
