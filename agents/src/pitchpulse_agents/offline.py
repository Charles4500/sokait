"""Offline chat client: deterministic, rule-based stand-in for a real model.

Used for local development without cloud credentials and for tests. It speaks the
same Agent Framework chat-client protocol as the Foundry client, so the agents and
the workflow are identical in both modes.
"""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from typing import Any

from agent_framework import BaseChatClient, ChatResponse, Message

from .models import AskOut, Insight, NarrationOut, RecapOut
from .recap import deterministic_recap


class OfflineChatClient(BaseChatClient):
    def __init__(self, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.calls = 0

    def _inner_get_response(
        self,
        *,
        messages: Sequence[Message],
        stream: bool,
        options: Mapping[str, Any],
        **_: Any,
    ):
        return self._respond(messages, options)

    async def _respond(
        self, messages: Sequence[Message], options: Mapping[str, Any]
    ) -> ChatResponse:
        self.calls += 1
        payload = json.loads(messages[-1].text or "{}")
        fmt = options.get("response_format")
        if fmt is Insight:
            body = _analyse(payload)
        elif fmt is NarrationOut:
            body = {"text": _narrate(payload)}
        elif fmt is RecapOut:
            body = deterministic_recap(payload)
        elif fmt is AskOut:
            body = {"answer": _answer(payload)}
        else:
            body = {"text": "ok"}
        return ChatResponse(messages=[Message("assistant", [json.dumps(body)])])


def _analyse(p: dict[str, Any]) -> dict[str, Any]:
    e, f = p["event"], p["facts"]
    kind = e.get("type")
    if kind in ("goal", "shot") and "event.xg" in f:
        return {
            "category": "milestone" if kind == "goal" else "chance_quality",
            "claim": "A high-value chance that shifts the expected story of the match."
            if f["event.xg"] >= 0.3
            else "A low-probability effort, more hope than threat.",
            "evidence": [{"stat": "event.xg", "value": f["event.xg"]}]
            + (
                [{"stat": "event.ballSpeed", "value": f["event.ballSpeed"]}]
                if "event.ballSpeed" in f
                else []
            ),
        }
    if kind == "pass" and f.get("event.passDifficulty", 0) > 7:
        return {
            "category": "player_moment",
            "claim": "An elite pass that breaks the press.",
            "evidence": [
                {"stat": "event.passDifficulty", "value": f["event.passDifficulty"]}
            ],
        }
    if f.get("chaos", 0) > 45:
        return {
            "category": "control_vs_chaos",
            "claim": "The game has tipped into chaos; neither side can keep the ball.",
            "evidence": [{"stat": "chaos", "value": f["chaos"]}],
        }
    if kind in ("pressure", "tackle"):
        side = e.get("team", "home")
        return {
            "category": "pressure_shift",
            "claim": "The press is starting to bite.",
            "evidence": [
                {"stat": f"pressure.{side}", "value": f.get(f"pressure.{side}", 0)}
            ],
        }
    return {
        "category": "rhythm_change",
        "claim": "A patient spell of control.",
        "evidence": [{"stat": "control", "value": f.get("control", 0)}],
    }


def _narrate(p: dict[str, Any]) -> str:
    ins, seg = p["insight"], p["segment"]
    ev = ins["evidence"][0]
    stat = ev["stat"].split(".")[-1]
    value = (
        f"{float(ev['value']):g}"
        if isinstance(ev["value"], (int, float))
        else ev["value"]
    )
    actor = p["event"].get("player", "")
    if seg["persona"] == "analyst":
        return f"{actor}: {ins['claim']} {stat} {value}."
    if seg["persona"] == "audio":
        where = p["event"].get("where", "")
        return (
            f"{actor}, {where}. {ins['claim']}" if where else f"{actor}. {ins['claim']}"
        )
    if seg["persona"] == "player":
        focus = seg.get("favourite_player") or actor
        if focus == actor:
            return f"Eyes on {focus}: {ins['claim'].lower()}"
        return f"Eyes on {focus} as {actor} acts: {ins['claim'].lower()}"
    return f"{actor}! {ins['claim']}"


def _answer(p: dict[str, Any]) -> str:
    home, away = p["teams"]["home"], p["teams"]["away"]
    s = p["score"]
    return (
        f"It is {home['name']} {s['home']}, {away['name']} {s['away']}, "
        f"in minute {p['minute']}."
    )
