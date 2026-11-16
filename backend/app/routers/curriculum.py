from fastapi import APIRouter, HTTPException, Query
from app.database import db

router = APIRouter(prefix="/api/curriculum", tags=["Curriculum"])

# Temporary local curriculum for development and demonstration.
LOCAL_CURRICULUM = {
    "nursery": {
        "class_id": "nursery",
        "label": "Nursery",
        "suggested_age": "3-4 years",
        "domains": [
            {
                "label": "Language",
                "subjects": [
                    {
                        "id": "english",
                        "label": "English",
                        "units": [
                            {
                                "id": "alphabet",
                                "label": "Alphabet",
                                "topics": ["Letter A", "Letter B", "Letter C"]
                            },
                            {
                                "id": "words",
                                "label": "Basic Words",
                                "topics": ["Animals", "Fruits", "Colors"]
                            }
                        ]
                    }
                ]
            },
            {
                "label": "Numeracy",
                "subjects": [
                    {
                        "id": "mathematics",
                        "label": "Mathematics",
                        "units": [
                            {
                                "id": "numbers",
                                "label": "Numbers",
                                "topics": ["Numbers 1-5", "Counting"]
                            },
                            {
                                "id": "shapes",
                                "label": "Shapes",
                                "topics": ["Circle", "Square", "Triangle"]
                            }
                        ]
                    }
                ]
            }
        ]
    },

    "lkg": {
        "class_id": "lkg",
        "label": "LKG",
        "suggested_age": "4-5 years",
        "domains": [
            {
                "label": "Language",
                "subjects": [
                    {
                        "id": "english",
                        "label": "English",
                        "units": [
                            {
                                "id": "alphabets",
                                "label": "Alphabets",
                                "topics": ["A-Z", "Vowels", "Consonants"]
                            },
                            {
                                "id": "words",
                                "label": "Words",
                                "topics": ["Three-letter words", "Picture words"]
                            }
                        ]
                    }
                ]
            },
            {
                "label": "Numeracy",
                "subjects": [
                    {
                        "id": "mathematics",
                        "label": "Mathematics",
                        "units": [
                            {
                                "id": "numbers",
                                "label": "Numbers",
                                "topics": ["Numbers 1-50", "Counting", "Before and After"]
                            },
                            {
                                "id": "shapes",
                                "label": "Shapes",
                                "topics": ["2D Shapes", "Patterns"]
                            }
                        ]
                    }
                ]
            }
        ]
    },

    "ukg": {
        "class_id": "ukg",
        "label": "UKG",
        "suggested_age": "5-6 years",
        "domains": [
            {
                "label": "Language",
                "subjects": [
                    {
                        "id": "english",
                        "label": "English",
                        "units": [
                            {
                                "id": "reading",
                                "label": "Reading",
                                "topics": ["Simple Sentences", "Phonics"]
                            },
                            {
                                "id": "writing",
                                "label": "Writing",
                                "topics": ["Capital Letters", "Small Letters", "Words"]
                            }
                        ]
                    }
                ]
            },
            {
                "label": "Numeracy",
                "subjects": [
                    {
                        "id": "mathematics",
                        "label": "Mathematics",
                        "units": [
                            {
                                "id": "numbers",
                                "label": "Numbers",
                                "topics": ["Numbers 1-100", "Addition", "Subtraction"]
                            },
                            {
                                "id": "shapes",
                                "label": "Shapes",
                                "topics": ["Shapes", "Patterns", "Measurements"]
                            }
                        ]
                    }
                ]
            }
        ]
    }
}


def get_curriculum(class_id):
    class_id = class_id.lower()

    # Try MongoDB first.
    if db is not None:
        try:
            document = db["curriculum"].find_one(
                {"class_id": class_id},
                {"_id": 0}
            )
            if document:
                return document
        except Exception:
            pass

    # Use local curriculum if MongoDB is unavailable.
    return LOCAL_CURRICULUM.get(class_id)


@router.get("/classes")
def list_classes():
    classes = []

    for class_id, document in LOCAL_CURRICULUM.items():
        classes.append({
            "class_id": class_id,
            "label": document["label"],
            "suggested_age": document["suggested_age"]
        })

    return {"classes": classes}


@router.get("/{class_id}")
def get_class_curriculum(class_id: str):
    document = get_curriculum(class_id)

    if not document:
        raise HTTPException(status_code=404, detail="Class not found")

    return document


@router.get("/{class_id}/subjects")
def get_subjects(class_id: str):
    document = get_curriculum(class_id)

    if not document:
        raise HTTPException(status_code=404, detail="Class not found")

    subjects = []

    for domain in document.get("domains", []):
        for subject in domain.get("subjects", []):
            subjects.append({
                **subject,
                "domain": domain.get("label", "")
            })

    return {
        "class_id": document["class_id"],
        "subjects": subjects
    }


@router.get("/{class_id}/topics")
def get_topics(class_id: str, subject_id: str = Query(...)):
    document = get_curriculum(class_id)

    if not document:
        raise HTTPException(status_code=404, detail="Class not found")

    for domain in document.get("domains", []):
        for subject in domain.get("subjects", []):
            if subject.get("id") == subject_id:
                return {
                    "class_id": class_id.lower(),
                    "subject": subject,
                    "units": subject.get("units", [])
                }

    raise HTTPException(status_code=404, detail="Subject not found")
