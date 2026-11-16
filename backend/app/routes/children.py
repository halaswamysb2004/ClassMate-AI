from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.database import get_connection
from app.routes.auth import get_current_parent

router = APIRouter(
    prefix="/api/children",
    tags=["Child Profiles"]
)


class ChildCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    age: int = Field(ge=2, le=8)
    language: str = Field(min_length=2, max_length=30)
    learning_level: str = "Beginner"


@router.post("/")
def create_child(
    data: ChildCreate,
    parent=Depends(get_current_parent)
):
    name = data.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Child name is required")

    if data.learning_level not in ["Beginner", "Intermediate", "Advanced"]:
        raise HTTPException(status_code=400, detail="Invalid learning level")

    connection = get_connection()

    cursor = connection.execute(
        """
        INSERT INTO children
        (parent_id, name, age, language, learning_level)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            parent["id"],
            name,
            data.age,
            data.language.strip(),
            data.learning_level
        )
    )

    connection.commit()
    child_id = cursor.lastrowid
    connection.close()

    return {
        "message": "Child profile created successfully",
        "child": {
            "id": child_id,
            "name": name,
            "age": data.age,
            "language": data.language,
            "learning_level": data.learning_level
        }
    }


@router.get("/")
def get_children(parent=Depends(get_current_parent)):
    connection = get_connection()

    children = connection.execute(
        """
        SELECT id, name, age, language, learning_level
        FROM children
        WHERE parent_id = ?
        ORDER BY id DESC
        """,
        (parent["id"],)
    ).fetchall()

    connection.close()

    return {
        "children": [dict(child) for child in children]
    }
