"""HTTP API: POST /tts → WAV audio. Kept as its own service because Piper is GPL-3.0."""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

from .tts import Speaker

speaker = Speaker()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Loading a voice takes seconds; do it before the first listener needs it.
    # VOICE_PRELOAD="English,Swahili" (default English); others load on first use.
    langs = [x.strip() for x in os.getenv("VOICE_PRELOAD", "English").split(",")]
    warm = asyncio.gather(*(speaker.speak("Ready.", lang) for lang in langs if lang))
    yield
    warm.cancel()


app = FastAPI(title="Sokait voice", version="0.1.0", lifespan=lifespan)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    language: str = "English"


def _authorise(authorization: str | None) -> None:
    # Shared with the web app; unset means local dev (no auth).
    token = os.getenv("VOICE_TOKEN")
    if token and authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="invalid token")


@app.get("/healthz")
async def healthz() -> dict:
    return {"ok": True, "languages": speaker.available()}


@app.post("/tts", response_class=Response)
async def tts(
    req: SpeakRequest, authorization: str | None = Header(default=None)
) -> Response:
    _authorise(authorization)
    audio = await speaker.speak(req.text, req.language)
    if audio is None:
        raise HTTPException(status_code=404, detail=f"no voice for {req.language}")
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "public, max-age=3600"},
    )
