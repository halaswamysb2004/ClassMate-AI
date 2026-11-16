import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_DIR / ".env", override=False)

SQLITE_DB_PATH = Path(
    os.getenv("SQLITE_DB_PATH", str(BACKEND_DIR / "classmate.db"))
)

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
    SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    with get_connection() as connection:
        schema_path = BACKEND_DIR / "app" / "schema.sql"

        with open(schema_path, "r", encoding="utf-8") as schema_file:
            connection.executescript(schema_file.read())

        print("SQLite database initialized successfully.")

    try:
        ping_mongodb()
        db["curriculum"].create_index("class_id", unique=True)
        print("MongoDB Atlas connected successfully.")
    except Exception as error:
        print("MongoDB Atlas unavailable. Using local curriculum.")
        print("Connection error:", error)
