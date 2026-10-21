"""HTTP API for the web app: POST /moments → verified, personalised overlay."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

# Local dev reads agents/.env; real environment variables always win.
load_dotenv()

from .clients import backend_name
from .models import Answer, AskRequest, MomentRequest, Overlay, Recap, RecapRequest
from .tts import Speaker
from .workflow import InsightsEngine

app = FastAPI(title="PitchPulse agents", version="0.1.0")
engine = InsightsEngine()
speaker = Speaker()


def _authorise(authorization: str | None) -> None:
    # The web app and this service share AGENTS_TOKEN; unset means local dev (no auth).
    token = os.getenv("AGENTS_TOKEN")
    if token and authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="invalid token")


@app.get("/healthz")
async def healthz() -> dict:
    return {
        "ok": True,
        "backend": backend_name(),
        "circuit_open": engine.breaker.is_open,
        "budget_s": engine.budget_s,
        "tts_languages": speaker.available(),
        "cache": {
            "analyses": engine.analyses.stats(),
            "narrations": engine.narrations.stats(),
        },
    }


@app.post("/moments", response_model=Overlay, response_model_by_alias=True)
async def moments(
    req: MomentRequest, authorization: str | None = Header(default=None)
) -> Overlay:
    _authorise(authorization)
    return await engine.process(req)


@app.post("/recap", response_model=Recap)
async def recap(
    req: RecapRequest, authorization: str | None = Header(default=None)
) -> Recap:
    _authorise(authorization)
    return await engine.recap(req)


@app.post("/ask", response_model=Answer)
async def ask(
    req: AskRequest, authorization: str | None = Header(default=None)
) -> Answer:
    _authorise(authorization)
    return await engine.ask(req)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=400)
    language: str = "English"


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
