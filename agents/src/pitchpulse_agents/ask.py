"""Match Q&A agent: answers a fan's spoken question, checked like every overlay."""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

from agent_framework import Agent

from .clients import run_options
from .facts import build_ask_facts, check_numbers
from .memory import CircuitBreaker, MemoryStore
from .models import Answer, AskOut, AskRequest, TraceStep, Verification

MAX_ATTEMPTS = 2
MAX_ANSWER_CHARS = 320
FALLBACK = (
    "Sorry, I can't answer that right now. You can ask for the score, the time, "
    "where the ball is, or how a player is doing."
)


async def answer_question(
    req: AskRequest,
    agent: Agent,
    memory: MemoryStore,
    breaker: CircuitBreaker,
    budget_s: float,
) -> Answer:
    t0 = time.perf_counter()

    def ms() -> int:
        return round((time.perf_counter() - t0) * 1000)

    aired = memory.get(req.match_id, req.moment_id).recent(n=10)
    facts = build_ask_facts(req, aired)
    payload: dict[str, Any] = {
        **req.model_dump(
            include={
                "question",
                "minute",
                "score",
                "stats",
                "extra",
                "recent_events",
                "segment",
            }
        ),
        "teams": {k: v.model_dump() for k, v in req.teams.items()},
        "aired_insights": aired,
    }
    trace: list[TraceStep] = []
    issues: list[str] = []

    if breaker.is_open:
        trace.append(
            TraceStep(agent="match_qa", ms=0, status="skipped", note="circuit open")
        )
    else:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            if issues:
                payload["feedback"] = issues
            try:
                r = await asyncio.wait_for(
                    agent.run(json.dumps(payload), options=run_options(AskOut)),
                    timeout=budget_s,
                )
            except TimeoutError:
                breaker.failure()
                trace.append(TraceStep(agent="match_qa", ms=ms(), status="timeout"))
                break
            except Exception as e:  # noqa: BLE001 - any model failure falls back
                breaker.failure()
                trace.append(
                    TraceStep(
                        agent="match_qa", ms=ms(), status="error", note=type(e).__name__
                    )
                )
                break
            out = r.value if isinstance(r.value, AskOut) else None
            if out is None or not out.answer.strip():
                issues = ["unparseable or empty answer"]
            else:
                issues = check_numbers(out.answer, facts)
                if len(out.answer) > MAX_ANSWER_CHARS:
                    issues.append(f"too long to read aloud ({len(out.answer)} chars)")
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
                return Answer(
                    match_id=req.match_id,
                    question=req.question,
                    answer=out.answer.strip(),
                    verification=Verification(
                        status="pass" if attempt == 1 else "repaired", attempts=attempt
                    ),
                    trace=[TraceStep(agent="match_qa", ms=ms(), status="ok"), *trace],
                )

    return Answer(
        match_id=req.match_id,
        question=req.question,
        answer=FALLBACK,
        verification=Verification(
            status="fallback", attempts=len(trace), issues=issues
        ),
        trace=trace,
    )
