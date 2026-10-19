"""Typed contracts shared by the web app, the agents and the overlay feed."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

Persona = Literal["analyst", "casual", "player"]
InsightCategory = Literal[
    "chance_quality",
    "control_vs_chaos",
    "pressure_shift",
    "rhythm_change",
    "player_moment",
    "milestone",
]
VerificationStatus = Literal["pass", "repaired", "fallback"]


class Team(BaseModel):
    name: str
    short: str


class Segment(BaseModel):
    """One audience slice. Narration runs once per segment, never once per viewer."""

    persona: Persona
    language: str = "English"
    favourite_player: str | None = None
    favourite_club: str | None = None

    def key(self) -> str:
        return f"{self.persona}|{self.language}|{self.favourite_player or '-'}|{self.favourite_club or '-'}"


class MomentRequest(BaseModel):
    """A key moment sent by the web app after its deterministic interpreter ran."""

    match_id: str
    moment_id: str = Field(description='"gen:seq" from the match stream')
    minute: int
    event: dict[str, Any] = Field(
        description="Match-engine event with `player`/`target` flattened to names"
    )
    score: dict[str, int]
    stats: dict[str, Any]
    teams: dict[str, Team]
    segments: list[Segment] = Field(min_length=1, max_length=24)
    fallback_text: str = Field(
        description="Deterministic explanation shown until AI text arrives"
    )


class Evidence(BaseModel):
    stat: str = Field(
        description='Dotted key into the facts table, e.g. "xg.home" or "event.xg"'
    )
    value: float | str


class Insight(BaseModel):
    """The Analyst's single, persona-neutral reading of a moment."""

    category: InsightCategory
    claim: str = Field(description="One sentence: why this moment matters")
    evidence: list[Evidence] = Field(min_length=1, max_length=6)


class NarrationOut(BaseModel):
    text: str


class Verification(BaseModel):
    status: VerificationStatus
    attempts: int
    issues: list[str] = []


class SegmentOverlay(BaseModel):
    segment: Segment
    text: str
    verification: Verification


class TraceStep(BaseModel):
    agent: str
    ms: int
    status: Literal["ok", "retry", "skipped", "error", "timeout"]
    note: str = ""


class RecapRequest(BaseModel):
    match_id: str
    moment_id: str = Field(
        description='Latest "gen:seq"; selects the match memory generation'
    )
    minute: int
    score: dict[str, int]
    stats: dict[str, Any]
    teams: dict[str, Team]
    segment: Segment
    key_moments: list[str] = Field(default=[], max_length=30)
    mvp: str | None = None


class RecapOut(BaseModel):
    headline: str
    bullets: list[str] = Field(min_length=1, max_length=5)


class Recap(BaseModel):
    match_id: str
    minute: int
    segment: Segment
    headline: str
    bullets: list[str]
    verification: Verification
    trace: list[TraceStep]


class Overlay(BaseModel):
    """What goes on air. `schema` lets broadcast partners version their parsers."""

    schema_: Literal["smie.overlay.v2"] = Field("smie.overlay.v2", alias="schema")
    match_id: str
    moment_id: str
    minute: int
    show: bool
    duration_ms: int
    headline: str
    insight: Insight | None
    narrations: list[SegmentOverlay]
    fallback: bool = Field(description="True when no AI text made it on air")
    trace: list[TraceStep]

    model_config = {"populate_by_name": True}
