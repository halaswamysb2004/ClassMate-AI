import os
import jwt

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from pwdlib import PasswordHash
from dotenv import load_dotenv

from app.database import get_connection

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Parent Authentication"])

password_hash = PasswordHash.recommended()
security = HTTPBearer()

JWT_SECRET = os.getenv("JWT_SECRET")

if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is missing from .env")

JWT_ALGORITHM = "HS256"


class ParentRegister(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str = Field(min_length=8, max_length=128)


class ParentLogin(BaseModel):
    email: str
    password: str


def create_token(parent_id):
    payload = {
        "sub": str(parent_id),
        "exp": datetime.now(timezone.utc) + timedelta(hours=2)
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_parent(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        parent_id = int(payload["sub"])

    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login session"
        )

    connection = get_connection()

    parent = connection.execute(
        "SELECT id, name, email FROM parents WHERE id = ?",
        (parent_id,)
    ).fetchone()

    connection.close()

    if not parent:
        raise HTTPException(status_code=401, detail="Parent account not found")

    return dict(parent)


@router.post("/register")
def register_parent(data: ParentRegister):

    name = data.name.strip()
    email = data.email.strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    if email.count("@") != 1 or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    hashed_password = password_hash.hash(data.password)

    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            INSERT INTO parents (name, email, password_hash)
            VALUES (?, ?, ?)
            """,
            (name, email, hashed_password)
        )

        connection.commit()
        parent_id = cursor.lastrowid

    except Exception as error:
        connection.close()

        if "UNIQUE constraint failed" in str(error):
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists"
            )

        raise HTTPException(status_code=500, detail="Registration failed")

    connection.close()

    token = create_token(parent_id)

    return {
        "message": "Parent registered successfully",
        "access_token": token,
        "token_type": "bearer",
        "parent": {
            "id": parent_id,
            "name": name,
            "email": email
        }
    }


@router.post("/login")
def login_parent(data: ParentLogin):

    email = data.email.strip().lower()

    connection = get_connection()

    parent = connection.execute(
        "SELECT * FROM parents WHERE email = ?",
        (email,)
    ).fetchone()

    connection.close()

    if not parent or not password_hash.verify(
        data.password, parent["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    token = create_token(parent["id"])

    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "parent": {
            "id": parent["id"],
            "name": parent["name"],
            "email": parent["email"]
        }
    }


@router.get("/me")
def get_parent_profile(parent=Depends(get_current_parent)):
    return {
        "message": "Authenticated parent",
        "parent": parent
    }
class ParentExitRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


@router.post("/verify-parent")
def verify_parent_for_exit(
    data: ParentExitRequest,
    parent=Depends(get_current_parent)
):
    connection = get_connection()

    try:
        account = connection.execute(
            """
            SELECT password_hash
            FROM parents
            WHERE id = ?
            """,
            (parent["id"],)
        ).fetchone()

        if not account or not password_hash.verify(
            data.password,
            account["password_hash"]
        ):
            raise HTTPException(
                status_code=401,
                detail="Incorrect parent password."
            )

        return {
            "verified": True,
            "message": "Parent verified successfully."
        }

    finally:
        connection.close()
