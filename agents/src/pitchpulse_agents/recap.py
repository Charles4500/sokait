"""Recap Editor: one agent over the whole match memory, checked like every overlay."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from agent_framework import Agent

from .clients import run_options
from .facts import build_recap_facts, check_numbers
from .memory import CircuitBreaker, MemoryStore
from .models import Recap, RecapOut, RecapRequest, TraceStep, Verification

MAX_ATTEMPTS = 2


def deterministic_recap(p: dict[str, Any]) -> dict[str, Any]:
    """Plain recap from computed stats only. Used offline and as the fallback."""
    home, away = p["teams"]["home"], p["teams"]["away"]
    s, st = p["score"], p["stats"]
    lead = home if s["home"] > s["away"] else away if s["away"] > s["home"] else None
    headline = (
        f"{lead['name']} lead {max(s.values())}-{min(s.values())} after {p['minute']} minutes"
        if lead
        else f"All square at {s['home']}-{s['away']} after {p['minute']} minutes"
    )
    bullets = [
        f"xG {st['xg']['home']} for {home['short']} against {st['xg']['away']} for {away['short']}.",
        f"Control index at {st['control']}%, with a {st['chaos']}% turnover rate.",
    ]
    bullets += [f"Key moment: {m}" for m in p.get("key_moments", [])[:2]]
    if p.get("mvp"):
        bullets.append(f"Standout performer: {p['mvp']}.")
    return {"headline": headline, "bullets": bullets[:5]}


async def write_recap(
    req: RecapRequest,
    agent: Agent,
    memory: MemoryStore,
    breaker: CircuitBreaker,
    budget_s: float,
) -> Recap:
    t0 = time.perf_counter()
    ms = lambda: round((time.perf_counter() - t0) * 1000)
    aired = memory.get(req.match_id, req.moment_id).recent(n=40)
    facts = build_recap_facts(req, aired)
    payload: dict[str, Any] = {
        **req.model_dump(
            include={"minute", "score", "stats", "key_moments", "mvp", "segment"}
        ),
        "teams": {k: v.model_dump() for k, v in req.teams.items()},
        "aired_insights": aired,
    }
    trace: list[TraceStep] = []
    issues: list[str] = []

    if not breaker.is_open:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            if issues:
                payload["feedback"] = issues
            try:
                r = await asyncio.wait_for(
                    agent.run(json.dumps(payload), options=run_options(RecapOut)),
                    timeout=budget_s,
                )
            except TimeoutError:
                breaker.failure()
                trace.append(TraceStep(agent="recap_editor", ms=ms(), status="timeout"))
                break
            except Exception as e:  # noqa: BLE001 - any model failure falls back
                breaker.failure()
                trace.append(
                    TraceStep(
                        agent="recap_editor",
                        ms=ms(),
                        status="error",
                        note=type(e).__name__,
                    )
                )
                break
            out = r.value if isinstance(r.value, RecapOut) else None
            if out is None:
                issues = ["unparseable output"]
            else:
                issues = [
                    i
                    for line in [out.headline, *out.bullets]
                    for i in check_numbers(line, facts)
                ]
            trace.append(
                TraceStep(
                    agent="fact_checker",
                    ms=ms(),
                    status="ok" if not issues else "retry",
                    note="; ".join(issues)[:200],
                )
            )
            if out and not issues:
                breaker.success()
                status = "pass" if attempt == 1 else "repaired"
                return Recap(
                    match_id=req.match_id,
                    minute=req.minute,
                    segment=req.segment,
                    headline=out.headline,
                    bullets=out.bullets,
                    verification=Verification(status=status, attempts=attempt),
                    trace=[
                        TraceStep(agent="recap_editor", ms=ms(), status="ok"),
                        *trace,
                    ],
                )
    else:
        trace.append(
            TraceStep(agent="recap_editor", ms=0, status="skipped", note="circuit open")
        )

    plain = deterministic_recap({**payload, "teams": payload["teams"]})
    return Recap(
        match_id=req.match_id,
        minute=req.minute,
        segment=req.segment,
        headline=plain["headline"],
        bullets=plain["bullets"],
        verification=Verification(
            status="fallback", attempts=len(trace), issues=issues
        ),
        trace=trace,
    )
