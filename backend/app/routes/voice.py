import os
import time
import requests
import threading

from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter(
    prefix="/api/voice",
    tags=["Gnani AI Voice"]
)

# Reuse HTTP connections
session = requests.Session()
tts_lock = threading.Lock()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@router.post("/speak")
def speak(request: SpeakRequest):

    api_key = os.getenv("GNANI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Gnani API key is missing"
        )

    url = "https://api.vachana.ai/api/v1/tts/inference"

    headers = {
        "X-API-Key-ID": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "text": request.text,
        "model": "timbre-v2.5",
        "voice": "Kaveri",
        "language": "en-IN",
        "speed": 1.0,
        "audio_config": {
            "sample_rate": 48000,
            "num_channels": 1,
            "sample_width": 2,
            "encoding": "linear_pcm",
            "container": "wav"
        }
    }

    start_time = time.perf_counter()

    try:
        # Gnani Timbre permits only one active request at a time.
        with tts_lock:
            response = session.post(
                url,
                headers=headers,
                json=payload,
                timeout=(5, 30)
            )

        if response.status_code != 200:
            print("Timbre API error:", response.text)

            raise HTTPException(
                status_code=502,
                detail="Timbre audio generation failed"
            )

        if not response.content:
            raise HTTPException(
                status_code=502,
                detail="Timbre returned empty audio"
            )

        elapsed = round(
            (time.perf_counter() - start_time) * 1000
        )

        print(
            f"Timbre generation: {elapsed} ms | "
            f"Audio size: {len(response.content)} bytes | "
            f"Text length: {len(request.text)} characters"
        )

        return Response(
            content=response.content,
            media_type="audio/wav"
        )

    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Timbre request timed out"
        )

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Gnani AI"
        )

    except HTTPException:
        raise

    except Exception as error:
        print("Timbre error:", repr(error))

        raise HTTPException(
            status_code=500,
            detail="Unable to generate audio"
        )
