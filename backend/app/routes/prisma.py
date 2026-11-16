import asyncio
import os
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from gnani.stt import (
    GnaniSTTStreamClient,
    StreamTranscriptEvent,
    StreamErrorEvent,
)

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("classmate.prisma")

router = APIRouter(
    prefix="/api/voice",
    tags=["Gnani Prisma STT"]
)

ALLOWED_ORIGINS = {
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
}


@router.websocket("/listen")
async def listen(websocket: WebSocket):

    origin = websocket.headers.get("origin")

    if origin not in ALLOWED_ORIGINS:
        await websocket.close(code=1008)
        return

    await websocket.accept()

    api_key = os.getenv("GNANI_API_KEY")

    if not api_key:
        await websocket.send_json({
            "type": "error",
            "message": "Gnani API key missing"
        })
        await websocket.close()
        return

    client = GnaniSTTStreamClient(
        api_key=api_key,
        language_code="indic-auto",
        model="prisma-v3.0",
        language_candidates=["en-IN", "kn-IN"],
        sample_rate=16000,
        keywords=[
            "A", "Apple", "A for Apple", "Letter A",
            "Alphabet", "One", "Two", "Three",
            "Red", "Blue", "Green", "Elephant",
            "Lion", "Teacher", "Student", "ClassMate"
        ],
    )

    transcript_task = None

    # Buffer browser audio until we have exactly 1024 bytes.
    audio_buffer = bytearray()

    async def forward_transcripts():
        async for event in client.events():

            if isinstance(event, StreamTranscriptEvent):
                recognized = event.text.strip()

                if recognized:
                    logger.info(
                        "PRISMA RECOGNIZED: %s | Audio duration: %s ms | Prisma latency: %s ms | Segment: %s",
                        recognized,
                        event.audio_duration_ms,
                        event.latency,
                        event.segment_id
                    )

                    await websocket.send_json({
                        "type": "transcript",
                        "text": recognized,
                        "language": getattr(
                            event,
                            "detected_language_code",
                            None
                        ),
                        "audio_duration_ms": event.audio_duration_ms,
                        "prisma_latency_ms": event.latency
                    })

            elif isinstance(event, StreamErrorEvent):
                logger.error("PRISMA ERROR: %s", event.message)

                await websocket.send_json({
                    "type": "error",
                    "message": event.message
                })

    async def reconnect():
        nonlocal transcript_task

        logger.warning("PRISMA: Reconnecting...")

        if transcript_task and not transcript_task.done():
            transcript_task.cancel()

            try:
                await transcript_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        connected = await asyncio.wait_for(
            client.connect(),
            timeout=20
        )

        logger.info("PRISMA RECONNECTED: %s", connected)

        transcript_task = asyncio.create_task(
            forward_transcripts()
        )

        await websocket.send_json({
            "type": "status",
            "message": "Prisma reconnected."
        })

    try:
        connected = await asyncio.wait_for(
            client.connect(),
            timeout=20
        )

        logger.info("PRISMA CONNECTED: %s", connected)

        await websocket.send_json({
            "type": "ready",
            "sample_rate": connected.sample_rate,
            "chunk_size": connected.chunk_size
        })

        transcript_task = asyncio.create_task(
            forward_transcripts()
        )

        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            audio = message.get("bytes")

            if not audio:
                continue

            # Collect variable-sized browser audio packets.
            audio_buffer.extend(audio)

            # Gnani requires exactly 1024 bytes per packet.
            while len(audio_buffer) >= 1024:

                packet = bytes(audio_buffer[:1024])
                del audio_buffer[:1024]

                if not client.is_connected:
                    try:
                        await reconnect()
                    except Exception:
                        logger.exception("Prisma reconnection failed")

                        await websocket.send_json({
                            "type": "error",
                            "message": "Prisma connection lost."
                        })
                        audio_buffer.clear()
                        break

                try:
                    await client.send_audio(packet)

                except Exception:
                    logger.exception("Prisma audio send failed")

                    if not client.is_connected:
                        try:
                            await reconnect()
                            await client.send_audio(packet)
                        except Exception:
                            logger.exception("Prisma audio retry failed")
                            audio_buffer.clear()
                            break
                    else:
                        raise

    except WebSocketDisconnect:
        logger.info("Browser disconnected")

    except Exception:
        logger.exception("Prisma streaming failure")

    finally:
        if transcript_task and not transcript_task.done():
            transcript_task.cancel()

            try:
                await transcript_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        try:
            await client.close()
        except Exception:
            logger.exception("Prisma close failed")

        try:
            await websocket.close()
        except Exception:
            pass
