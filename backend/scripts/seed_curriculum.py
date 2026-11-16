import json
from pathlib import Path
from app.database import db, ping_mongodb

DATA_FILE = Path(__file__).resolve().parents[1] / "curriculum" / "foundational_stage.json"

def main():
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    collection = db["curriculum"]
    collection.create_index("class_id", unique=True)

    ping_mongodb()
    metadata = data.get("metadata", {})
    count = 0

    for class_id, class_data in data.get("classes", {}).items():
        document = {
            "class_id": class_id,
            **class_data,
            "curriculum_metadata": metadata
        }
        collection.update_one(
            {"class_id": class_id},
            {"$set": document},
            upsert=True
        )
        count += 1

    print(f"Successfully imported/updated {count} class curricula in MongoDB.")
    print(f"Database: {db.name} | Collection: curriculum")

if __name__ == "__main__":
    main()
