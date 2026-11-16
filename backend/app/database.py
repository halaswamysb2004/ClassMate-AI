import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env", override=False)

SQLITE_DB_PATH = BACKEND_DIR / "classmate.db"


def get_connection():
    connection = sqlite3.connect(str(SQLITE_DB_PATH))
    connection.row_factory = sqlite3.Row
    return connection


MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "classmate_ai")

client = None
db = None

if MONGODB_URI:
    client = MongoClient(
        MONGODB_URI,
        server_api=ServerApi("1"),
        serverSelectionTimeoutMS=3000
    )
    db = client[MONGODB_DB]


def ping_mongodb():
    if client is None:
        return False

    client.admin.command("ping")
    return True


def initialize_database():
    if not SQLITE_DB_PATH.exists():
        raise RuntimeError(
            f"SQLite database not found: {SQLITE_DB_PATH}"
        )

    with get_connection() as connection:
        connection.execute("SELECT 1").fetchone()

    print("SQLite database verified successfully.")

    try:
        ping_mongodb()
        db["curriculum"].create_index("class_id", unique=True)
        print("MongoDB Atlas connected successfully.")
    except Exception as error:
        print("MongoDB Atlas unavailable. Using local curriculum.")
        print("Connection error:", error)
