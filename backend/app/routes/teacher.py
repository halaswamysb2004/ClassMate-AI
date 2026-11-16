import os
import time
import json
import re
import requests

from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from app.database import db


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter(prefix="/api/teacher", tags=["AI Teacher"])
session = requests.Session()


# ============================================================
# 12-STAGE CURRICULUM
# ============================================================

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


# ============================================================
# REQUEST MODELS
# ============================================================

class TeacherRequest(BaseModel):
    question: str
    child_age: int = 5
    activity: str = "General Learning"
    history: list = Field(default_factory=list)
    attempts: int = 0


class LessonPlanRequest(BaseModel):
    child_name: str = "Little Learner"
    child_age: int = Field(default=5, ge=3, le=8)
    language: str = "English"
    learning_level: str = "Beginner"
    previous_topics: list[str] = Field(default_factory=list)

    class_id: str | None = None
    subject_id: str | None = None
    unit_id: str | None = None
    topic_name: str | None = None


# ============================================================
# JSON EXTRACTION
# ============================================================

def extract_json(text):

    text = text.strip()

    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)

    except json.JSONDecodeError:

        match = re.search(r"\{.*\}", text, re.DOTALL)

        if match:
            return json.loads(match.group(0))

        raise ValueError(
            "The teacher model did not return valid JSON."
        )


# ============================================================
# GEMINI AI CONNECTION
# ============================================================

def call_gemini(prompt):

    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Teacher AI API key is missing."
        )

    try:

        response = session.post(
            "https://generativelanguage.googleapis.com/v1beta/interactions",

            headers={
                "x-goog-api-key": api_key,
                "Content-Type": "application/json"
            },

            json={
                "model": "gemini-3.5-flash-lite",
                "input": prompt
            },

            timeout=(5, 60)
        )

        if not response.ok:

            print("Gemini error:", response.text)

            raise HTTPException(
                status_code=502,
                detail="Teacher AI request failed."
            )

        data = response.json()

        output = data.get("output_text", "")

        if not output:

            texts = []

            for step in data.get("steps", []):

                if step.get("type") == "model_output":

                    for item in step.get("content", []):

                        if item.get("type") == "text":
                            texts.append(item.get("text", ""))

            output = " ".join(texts).strip()

        return extract_json(output)

    except requests.exceptions.Timeout:

        raise HTTPException(
            status_code=504,
            detail="Teacher AI request timed out."
        )

    except HTTPException:
        raise

    except Exception as error:

        print("Gemini processing error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Unable to process the teacher AI response."
        )


# ============================================================
# CREATE AI LESSON PLAN
# ============================================================

@router.post("/plan")
def create_lesson_plan(request: LessonPlanRequest):

    selected_curriculum = None

    # --------------------------------------------------------
    # VERIFY SELECTED MONGODB CURRICULUM
    # --------------------------------------------------------

    if any([
        request.class_id,
        request.subject_id,
        request.unit_id,
        request.topic_name
    ]):

        if not all([
            request.class_id,
            request.subject_id,
            request.unit_id,
            request.topic_name
        ]):

            raise HTTPException(
                status_code=400,
                detail="Class, subject, unit and topic must all be selected."
            )

        class_doc = db["curriculum"].find_one(
            {"class_id": request.class_id.lower()},
            {"_id": 0}
        )

        if not class_doc:

            raise HTTPException(
                status_code=404,
                detail="Selected class not found."
            )

        for domain in class_doc.get("domains", []):

            for subject in domain.get("subjects", []):

                if subject.get("id") != request.subject_id:
                    continue

                for unit in subject.get("units", []):

                    if unit.get("id") != request.unit_id:
                        continue

                    if request.topic_name not in unit.get("topics", []):
                        continue

                    selected_curriculum = {
                        "class": class_doc.get("label"),
                        "subject": subject.get("label"),
                        "unit": unit.get("title"),
                        "topic": request.topic_name,
                        "learning_outcomes": unit.get("outcomes", []),
                        "suggested_activities": unit.get("activities", [])
                    }

        if not selected_curriculum:

            raise HTTPException(
                status_code=400,
                detail="The selected subject, unit or topic is not in the curriculum."
            )

    # --------------------------------------------------------
    # PREPARE CURRICULUM DATA
    # --------------------------------------------------------

    curriculum_text = json.dumps(
        CURRICULUM,
        ensure_ascii=False
    )

    selected_text = json.dumps(
        selected_curriculum or {},
        ensure_ascii=False
    )

    # --------------------------------------------------------
    # AI TEACHER PROMPT
    # --------------------------------------------------------

    prompt = f"""
You are ClassMate AI, a warm, caring, highly interactive
Indian kindergarten teacher.

Your job is to conduct a complete school-like learning session.

Speak naturally to the child, like a real teacher who enjoys teaching.

CHILD:

Name: {request.child_name}
Age: {request.child_age}
Language: {request.language}
Learning level: {request.learning_level}

TODAY'S VERIFIED CURRICULUM:

{selected_text}

PREVIOUS TOPICS:

{request.previous_topics}

SESSION STRUCTURE:

{curriculum_text}

IMPORTANT CURRICULUM RULE:

The selected topic and its learning outcomes are the MAIN SYLLABUS.

Do not replace them with unrelated alphabet, number, animal or colour lessons.

Use games, colours, stories and general knowledge only as supporting activities
when they naturally reinforce the selected learning objectives.

Create exactly 12 stages in this order:

greeting, alphabet, numbers, colours, animals, games, stories,
knowledge, writing, quiz, assessment, goodbye.

Adapt the content of every stage to today's selected topic.

IMPORTANT STAGE ADAPTATION:

- The stage_id "alphabet" is a fixed stage identifier, not an instruction
  to teach alphabets in every subject.

- For Mathematics, use this stage for a short mathematical observation,
  pattern, shape or counting activity.

- For EVS, use it for a short nature or environment observation.

- For English, use it for actual letter and sound learning when relevant.

- For Art and Life Skills, use it for a short creative activity.

- Never introduce unrelated alphabet teaching in a Mathematics lesson.

- The "numbers" stage should also adapt to the selected subject.

- Every stage must contribute to today's selected learning topic.

- Do not teach unrelated full lessons merely to fill a stage.

TEACHING STYLE:

- Be affectionate, friendly, patient and encouraging.
- Use short, natural spoken sentences.
- Ask the child questions and pause for answers.
- Give simple examples from everyday Indian life.
- Explain concepts using visual objects and demonstrations.
- Never shame a child for mistakes.
- Answer spontaneous questions kindly and accurately when asked.
- If the child is distracted, gently guide them back.

VISUAL TEACHING:

- Give a specific visual description for every stage.
- For letters, show uppercase/lowercase forms, shape and stroke order.
- For numbers, show the numeral and matching quantities.
- For shapes and colours, show clear familiar objects.
- For other topics, describe relevant pictures or diagrams.
- Do not claim an animation exists unless the visual description specifies it.

WRITING PRACTICE:

The writing stage MUST contain a real guided writing activity.

Return an additional field:

"writing_target": the exact single letter, numeral or symbol to practise.

STRICT WRITING RULES:

1. writing_target MUST contain exactly one alphanumeric character.
2. expected_answer MUST contain exactly the same character as writing_target.
3. Both values MUST use identical representation.
4. For number-writing activities, use numerals, not number words.
   Example: writing_target = "5", expected_answer = "5".
5. For alphabet-writing activities:
   Example: writing_target = "A", expected_answer = "A".
6. Never use answers such as "Yes", "Okay" or sentences as writing targets.
7. Do not use spoken answers as writing assessment answers.

Explain the shape and formation of the relevant character.

Give stroke-by-stroke instructions where appropriate.

Include dotted tracing followed by independent writing.

If today's topic does not involve writing a character, provide a suitable
drawing, tracing, labelling or pre-writing activity and select a simple
appropriate writing_target.

FINAL TEST:

The assessment stage MUST be separate from guided writing practice.

The assessment stage is an independent spoken question-and-answer test.

Include at least one clear question that checks the selected topic's
learning outcomes.

For Mathematics, ask the child to count, identify, compare or recognise
quantities independently.

For English, check letter recognition, sounds or vocabulary.

For EVS, check understanding of the selected environmental topic.

The assessment question must not reveal its answer.

The expected_answer is for the teacher's evaluation only.

Do not include the expected answer in teacher_instruction or visual text.

Do not turn the assessment stage into another guided tracing activity.

The writing stage is the guided writing canvas activity.

The assessment stage is a separate independent verbal test.

STORIES AND GAMES:

Include a short age-appropriate story and interactive questions.

Include a fun educational game connected to today's topic.

The teacher may ask whether the child wants a short break before story time.

SAFETY:

Never request personal information, frighten, shame or threaten the child.

Keep all content suitable for the child's age.

Never invent facts when uncertain.

FOR EVERY STAGE RETURN:

stage_id, title, learning_objective, teaching_method,
teacher_instruction, visual, question, expected_answer, activity_type.

The writing stage MUST additionally return writing_target.

For all other stages, writing_target may be an empty string.

Return ONLY valid JSON in this structure:

{{
    "lesson_title": "Today's Learning Adventure",
    "child_name": "{request.child_name}",
    "language": "{request.language}",
    "selected_topic": {json.dumps(selected_curriculum or {}, ensure_ascii=False)},
    "stages": [
        {{
            "stage_id": "greeting",
            "title": "Greeting and Warm-up",
            "learning_objective": "Objective",
            "teaching_method": "Friendly conversation",
            "teacher_instruction": "Words spoken to the child",
            "visual": "Visual description",
            "question": "Question for the child",
            "expected_answer": "Expected answer",
            "activity_type": "conversation",
            "writing_target": ""
        }}
    ]
}}

Return all 12 stages in the exact required order.

For the writing stage, always return a valid single-character writing_target
and set expected_answer to exactly the same character.
"""

    # --------------------------------------------------------
    # CALL AI
    # --------------------------------------------------------

    result = call_gemini(prompt)

    if not isinstance(result, dict):

        raise HTTPException(
            status_code=502,
            detail="AI returned an invalid lesson structure."
        )

    stages = result.get("stages")

    if not isinstance(stages, list) or len(stages) != 12:

        raise HTTPException(
            status_code=502,
            detail="AI returned an incomplete lesson plan."
        )

    # --------------------------------------------------------
    # VERIFY STAGE ORDER
    # --------------------------------------------------------

    expected_ids = [
        stage["id"] for stage in CURRICULUM
    ]

    received_ids = [
        stage.get("stage_id") if isinstance(stage, dict) else None
        for stage in stages
    ]

    if received_ids != expected_ids:

        raise HTTPException(
            status_code=502,
            detail="AI lesson stages do not match the curriculum order."
        )

    # --------------------------------------------------------
    # VERIFY REQUIRED FIELDS
    # --------------------------------------------------------

    required_fields = [
        "title",
        "learning_objective",
        "teaching_method",
        "teacher_instruction",
        "visual",
        "question",
        "expected_answer",
        "activity_type"
    ]

    for stage in stages:

        for field in required_fields:

            if (
                not isinstance(stage.get(field), str)
                or not stage[field].strip()
            ):

                raise HTTPException(
                    status_code=502,
                    detail=f"AI lesson stage is missing: {field}"
                )

    # --------------------------------------------------------
    # WRITING STAGE VALIDATION AND NORMALIZATION
    # --------------------------------------------------------

    writing_stage = next(
        (
            stage for stage in stages
            if stage.get("stage_id") == "writing"
        ),
        None
    )

    if writing_stage is None:

        raise HTTPException(
            status_code=502,
            detail="AI lesson is missing the writing stage."
        )

    writing_target = writing_stage.get("writing_target")

    if (
        not isinstance(writing_target, str)
        or not re.fullmatch(
            r"[A-Za-z0-9]",
            writing_target.strip()
        )
    ):

        raise HTTPException(
            status_code=502,
            detail="AI writing stage must provide a single-character writing_target."
        )

    # IMPORTANT:
    # Use writing_target as the authoritative answer.
    # This prevents different AI representations such as
    # writing_target = "5" and expected_answer = "five".

    writing_target = writing_target.strip()

    writing_stage["writing_target"] = writing_target

    writing_stage["expected_answer"] = writing_target

    # --------------------------------------------------------
    # RETURN COMPLETE LESSON
    # --------------------------------------------------------

    return {
        "success": True,
        "lesson": result
    }


# ============================================================
# EVALUATE CHILD'S ANSWER
# ============================================================

@router.post("/evaluate")
def evaluate_answer(request: TeacherRequest):

    started_at = time.perf_counter()

    # --------------------------------------------------------
    # FAST PATH: EXACT ANSWER MATCH
    # --------------------------------------------------------

    expected_match = re.search(
        r"Expected answer:\s*(.*)",
        request.activity,
        re.IGNORECASE
    )

    if expected_match:

        expected = expected_match.group(1).strip().rstrip(".!?")

        spoken = request.question.strip()

        def normalize_answer(value):

            value = value.lower().strip()

            value = re.sub(
                r"[^a-z0-9 ]",
                " ",
                value
            )

            value = re.sub(
                r"\s+",
                " ",
                value
            ).strip()

            number_words = {
                "zero": "0",
                "one": "1",
                "two": "2",
                "three": "3",
                "four": "4",
                "five": "5",
                "six": "6",
                "seven": "7",
                "eight": "8",
                "nine": "9",
                "ten": "10"
            }

            return " ".join(
                number_words.get(word, word)
                for word in value.split()
            )

        expected_normalized = normalize_answer(expected)

        spoken_normalized = normalize_answer(spoken)

        # Only use fast path for a clear exact match.

        if (
            expected_normalized
            and spoken_normalized == expected_normalized
        ):

            elapsed = round(
                (time.perf_counter() - started_at) * 1000
            )

            print(f"FAST ANSWER: {elapsed} ms")

            return {
                "type": "answer",
                "correct": True,
                "feedback": "Wonderful! That's correct!",
                "teaching_method": "same",
                "next_action": "advance",
                "concept_understood": True,
                "latency_ms": elapsed
            }

    # --------------------------------------------------------
    # GEMINI EVALUATION
    # --------------------------------------------------------

    prompt = f"""
You are ClassMate, a caring preschool teacher teaching a child aged
{request.child_age}.

CURRENT LESSON:

{request.activity}

CHILD'S SPOKEN RESPONSE:

{request.question}

PREVIOUS UNSUCCESSFUL ATTEMPTS:

{request.attempts}

RECENT CONVERSATION:

{request.history[-4:]}

Evaluate the child's actual answer carefully.

RULES:

- Accept correct answers expressed in different words.
- Never mark an incorrect answer as correct.
- Understand simple, incomplete child sentences.
- If partially correct, acknowledge the correct part.
- If wrong, encourage the child and explain briefly.
- After repeated difficulty, use a different teaching method.
- Answer unrelated questions briefly and return to the lesson.
- Use short spoken sentences suitable for a 4–6 year old.
- Do not advance merely because the child said something.
- Keep feedback to one or two short sentences.

Return ONLY valid JSON:

{{
    "type": "answer",
    "correct": false,
    "feedback": "A short spoken response.",
    "teaching_method": "same",
    "next_action": "retry",
    "concept_understood": false
}}

Allowed type values: answer, question, repeat, off_topic.

Allowed teaching_method values: same, new.

Allowed next_action values: advance, retry, return_to_lesson.

For unrelated questions, use off_topic and return_to_lesson.

For requests to repeat, explain the task again.
"""

    result = call_gemini(prompt)

    # --------------------------------------------------------
    # VALIDATE AI RESPONSE
    # --------------------------------------------------------

    if not isinstance(result, dict):

        raise HTTPException(
            status_code=502,
            detail="Teacher returned an invalid evaluation."
        )

    required = [
        "type",
        "correct",
        "feedback",
        "teaching_method",
        "next_action"
    ]

    if any(key not in result for key in required):

        raise HTTPException(
            status_code=502,
            detail="Teacher response is missing required fields."
        )

    if result["next_action"] not in (
        "advance",
        "retry",
        "return_to_lesson"
    ):

        result["next_action"] = "retry"

    if result["teaching_method"] not in ("same", "new"):

        result["teaching_method"] = "same"

    if result["type"] not in (
        "answer",
        "question",
        "repeat",
        "off_topic"
    ):

        result["type"] = "answer"

    result["correct"] = bool(result["correct"])

    result["concept_understood"] = bool(
        result.get(
            "concept_understood",
            result["correct"]
        )
    )

    result["latency_ms"] = round(
        (time.perf_counter() - started_at) * 1000
    )

    print(
        f"Gemini evaluation: {result['latency_ms']} ms"
    )

    return result


# ============================================================
# COMPATIBILITY ENDPOINT
# ============================================================

@router.post("/ask")
def ask_teacher(request: TeacherRequest):

    result = evaluate_answer(request)

    return {
        "answer": result.get("feedback", ""),
        "type": result.get("type", "question"),
        "latency_ms": result.get("latency_ms", 0)
    }
