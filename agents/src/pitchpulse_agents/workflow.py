"""Moment workflow: Producer → Analyst → Narrator ⇄ Fact-Checker → Publisher.

Built with Microsoft Agent Framework workflows. Executors pass typed messages along
conditional edges; the Fact-Checker → Narrator edge is the repair loop. Every path,
including every failure, ends at the Publisher, so a moment always produces an overlay.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, Never

from agent_framework import Agent, Executor, WorkflowBuilder, WorkflowContext, handler

from .agents import make_analyst, make_narrator, make_recap_editor
from .clients import make_chat_client
from .facts import Facts, build_facts, check_evidence, check_numbers
from .memory import CircuitBreaker, MemoryStore
from .models import (
    Insight,
    MomentRequest,
    NarrationOut,
    Overlay,
    Recap,
    RecapRequest,
    Segment,
    SegmentOverlay,
    TraceStep,
    Verification,
)
from .recap import write_recap

ON_AIR_IMPORTANCE = 0.6
MAX_NARRATION_ATTEMPTS = 2
MAX_OVERLAY_CHARS = 280


# ---------- messages between executors ----------


@dataclass
class Job:
    req: MomentRequest
    facts: Facts
    recent: list[dict]
    trace: list[TraceStep] = field(default_factory=list)


@dataclass
class Analysed:
    job: Job
    insight: Insight


@dataclass
class Draft:
    segment: Segment
    text: str | None
    attempts: int = 1
    issues: list[str] = field(default_factory=list)


@dataclass
class Drafts:
    analysed: Analysed
    drafts: dict[str, Draft]


@dataclass
class RetryNarration:
    drafts: Drafts
    keys: list[str]


@dataclass
class Done:
    job: Job
    show: bool
    insight: Insight | None = None
    drafts: dict[str, Draft] | None = None


class _Timer:
    def __init__(self) -> None:
        self.t0 = time.perf_counter()

    @property
    def ms(self) -> int:
        return round((time.perf_counter() - self.t0) * 1000)


# ---------- executors ----------


class Producer(Executor):
    """Decides whether the moment goes on air and whether AI may run."""

    def __init__(self, memory: MemoryStore, breaker: CircuitBreaker) -> None:
        super().__init__(id="producer")
        self.memory = memory
        self.breaker = breaker

    @handler
    async def run(self, req: MomentRequest, ctx: WorkflowContext[Job | Done]) -> None:
        t = _Timer()
        mem = self.memory.get(req.match_id, req.moment_id)
        job = Job(req=req, facts=build_facts(req), recent=mem.recent())
        actor = req.event.get("player")
        player_focus = any(
            s.persona == "player" and s.favourite_player == actor for s in req.segments
        )
        show = (
            float(req.event.get("importance", 0)) >= ON_AIR_IMPORTANCE or player_focus
        )
        if not show:
            job.trace.append(
                TraceStep(
                    agent="producer",
                    ms=t.ms,
                    status="skipped",
                    note="below on-air threshold",
                )
            )
            await ctx.send_message(Done(job=job, show=False))
        elif self.breaker.is_open:
            job.trace.append(
                TraceStep(
                    agent="producer",
                    ms=t.ms,
                    status="skipped",
                    note="circuit open: deterministic mode",
                )
            )
            await ctx.send_message(Done(job=job, show=True))
        else:
            job.trace.append(
                TraceStep(
                    agent="producer",
                    ms=t.ms,
                    status="ok",
                    note=f"{len(req.segments)} segment(s)",
                )
            )
            await ctx.send_message(job)


class AnalystExecutor(Executor):
    """One persona-neutral insight per moment, with evidence checked against the facts."""

    def __init__(self, agent: Agent, breaker: CircuitBreaker) -> None:
        super().__init__(id="analyst")
        self.agent = agent
        self.breaker = breaker

    @handler
    async def run(self, job: Job, ctx: WorkflowContext[Analysed | Done]) -> None:
        t = _Timer()
        payload: dict[str, Any] = {
            "event": job.req.event,
            "facts": job.facts,
            "recent_insights": job.recent,
        }
        issues: list[str] = []
        for attempt in (1, 2):
            if issues:
                payload["feedback"] = issues
            try:
                r = await self.agent.run(
                    json.dumps(payload), options={"response_format": Insight}
                )
            except Exception as e:  # noqa: BLE001 - any model or network failure falls back
                self.breaker.failure()
                job.trace.append(
                    TraceStep(
                        agent="analyst", ms=t.ms, status="error", note=type(e).__name__
                    )
                )
                await ctx.send_message(Done(job=job, show=True))
                return
            insight = r.value if isinstance(r.value, Insight) else None
            issues = (
                check_evidence(insight.evidence, job.facts)
                if insight
                else ["unparseable output"]
            )
            if insight and not issues:
                status = "ok" if attempt == 1 else "retry"
                job.trace.append(
                    TraceStep(
                        agent="analyst", ms=t.ms, status=status, note=insight.category
                    )
                )
                await ctx.send_message(Analysed(job=job, insight=insight))
                return
        job.trace.append(
            TraceStep(
                agent="analyst", ms=t.ms, status="error", note="; ".join(issues)[:200]
            )
        )
        await ctx.send_message(Done(job=job, show=True))


class NarratorExecutor(Executor):
    """Writes overlay text for every segment in parallel; redoes rejected ones on retry."""

    def __init__(self, agent: Agent, breaker: CircuitBreaker) -> None:
        super().__init__(id="narrator")
        self.agent = agent
        self.breaker = breaker

    async def _narrate(
        self, a: Analysed, seg: Segment, feedback: list[str] | None
    ) -> str | None:
        payload: dict[str, Any] = {
            "insight": a.insight.model_dump(),
            "event": a.job.req.event,
            "segment": seg.model_dump(),
            "teams": {k: v.model_dump() for k, v in a.job.req.teams.items()},
        }
        if feedback:
            payload["feedback"] = feedback
        try:
            r = await self.agent.run(
                json.dumps(payload), options={"response_format": NarrationOut}
            )
        except Exception:  # noqa: BLE001 - any model failure falls back
            self.breaker.failure()
            return None
        return r.value.text.strip() if isinstance(r.value, NarrationOut) else None

    @handler
    async def first_draft(self, a: Analysed, ctx: WorkflowContext[Drafts]) -> None:
        t = _Timer()
        segs = {s.key(): s for s in a.job.req.segments}
        texts = await asyncio.gather(
            *(self._narrate(a, s, None) for s in segs.values())
        )
        drafts = {
            k: Draft(segment=s, text=txt) for (k, s), txt in zip(segs.items(), texts)
        }
        a.job.trace.append(
            TraceStep(
                agent="narrator", ms=t.ms, status="ok", note=f"{len(drafts)} draft(s)"
            )
        )
        await ctx.send_message(Drafts(analysed=a, drafts=drafts))

    @handler
    async def redraft(self, r: RetryNarration, ctx: WorkflowContext[Drafts]) -> None:
        t = _Timer()
        a, drafts = r.drafts.analysed, r.drafts.drafts
        texts = await asyncio.gather(
            *(self._narrate(a, drafts[k].segment, drafts[k].issues) for k in r.keys)
        )
        for k, txt in zip(r.keys, texts):
            drafts[k] = Draft(
                segment=drafts[k].segment, text=txt, attempts=drafts[k].attempts + 1
            )
        a.job.trace.append(
            TraceStep(
                agent="narrator",
                ms=t.ms,
                status="retry",
                note=f"redrafted {len(r.keys)}",
            )
        )
        await ctx.send_message(r.drafts)


class FactCheckerExecutor(Executor):
    """Rejects narration whose numbers are not in the match data; asks for one repair."""

    def __init__(self) -> None:
        super().__init__(id="fact_checker")

    @handler
    async def run(self, d: Drafts, ctx: WorkflowContext[RetryNarration | Done]) -> None:
        t = _Timer()
        facts = d.analysed.job.facts
        for draft in d.drafts.values():
            if draft.text is None:
                draft.issues = ["no narration (model error)"]
            elif not draft.text:
                draft.issues = ["empty narration"]
            else:
                draft.issues = check_numbers(draft.text, facts)
                if len(draft.text) > MAX_OVERLAY_CHARS:
                    draft.issues.append(
                        f"too long for an overlay ({len(draft.text)} chars)"
                    )
        retry = [
            k
            for k, dr in d.drafts.items()
            if dr.issues
            and dr.text is not None
            and dr.attempts < MAX_NARRATION_ATTEMPTS
        ]
        job = d.analysed.job
        if retry:
            job.trace.append(
                TraceStep(
                    agent="fact_checker",
                    ms=t.ms,
                    status="retry",
                    note=f"rejected {len(retry)}",
                )
            )
            await ctx.send_message(RetryNarration(drafts=d, keys=retry))
            return
        ok = sum(1 for dr in d.drafts.values() if not dr.issues)
        job.trace.append(
            TraceStep(
                agent="fact_checker",
                ms=t.ms,
                status="ok",
                note=f"{ok}/{len(d.drafts)} verified",
            )
        )
        await ctx.send_message(
            Done(job=job, show=True, insight=d.analysed.insight, drafts=d.drafts)
        )


class Publisher(Executor):
    """Assembles the on-air overlay, falling back per segment, and updates match memory."""

    def __init__(self, memory: MemoryStore, breaker: CircuitBreaker) -> None:
        super().__init__(id="publisher")
        self.memory = memory
        self.breaker = breaker

    @handler
    async def run(self, done: Done, ctx: WorkflowContext[Never, Overlay]) -> None:
        req = done.job.req
        overlay = assemble(req, done.job.trace, done.show, done.insight, done.drafts)
        if not overlay.fallback:
            self.breaker.success()
            if done.insight:
                self.memory.record(
                    req.match_id, req.moment_id, req.minute, done.insight
                )
        await ctx.yield_output(overlay)


def assemble(
    req: MomentRequest,
    trace: list[TraceStep],
    show: bool,
    insight: Insight | None,
    drafts: dict[str, Draft] | None,
) -> Overlay:
    narrations = []
    for seg in req.segments:
        dr = (drafts or {}).get(seg.key())
        if dr and dr.text and not dr.issues:
            v = Verification(
                status="pass" if dr.attempts == 1 else "repaired", attempts=dr.attempts
            )
            narrations.append(SegmentOverlay(segment=seg, text=dr.text, verification=v))
        else:
            v = Verification(
                status="fallback",
                attempts=dr.attempts if dr else 0,
                issues=dr.issues if dr else [],
            )
            narrations.append(
                SegmentOverlay(segment=seg, text=req.fallback_text, verification=v)
            )
    return Overlay(
        match_id=req.match_id,
        moment_id=req.moment_id,
        minute=req.minute,
        show=show,
        duration_ms=8000 if req.event.get("type") == "goal" else 4500,
        headline=f"{req.minute}' {req.event.get('label', '')}".strip(),
        insight=insight,
        narrations=narrations,
        fallback=all(n.verification.status == "fallback" for n in narrations),
        trace=trace,
    )


# ---------- engine ----------


def _is(t: type):
    return lambda m: isinstance(m, t)


class InsightsEngine:
    """Owns the agents and shared state; runs one workflow per moment within a time budget."""

    def __init__(
        self, client: Any | None = None, budget_s: float | None = None
    ) -> None:
        self.client = client if client is not None else make_chat_client()
        self.analyst = make_analyst(self.client)
        self.narrator = make_narrator(self.client)
        self.recap_editor = make_recap_editor(self.client)
        self.memory = MemoryStore()
        self.breaker = CircuitBreaker()
        self.budget_s = (
            budget_s
            if budget_s is not None
            else float(os.getenv("MOMENT_BUDGET_S", "2.5"))
        )

    def build(self):
        # Built per moment: executors are cheap, and runs stay isolated under concurrency.
        producer = Producer(self.memory, self.breaker)
        analyst = AnalystExecutor(self.analyst, self.breaker)
        narrator = NarratorExecutor(self.narrator, self.breaker)
        checker = FactCheckerExecutor()
        publisher = Publisher(self.memory, self.breaker)
        return (
            WorkflowBuilder(
                name="moment", start_executor=producer, output_from=[publisher]
            )
            .add_edge(producer, analyst, condition=_is(Job))
            .add_edge(producer, publisher, condition=_is(Done))
            .add_edge(analyst, narrator, condition=_is(Analysed))
            .add_edge(analyst, publisher, condition=_is(Done))
            .add_edge(narrator, checker)
            .add_edge(checker, narrator, condition=_is(RetryNarration))
            .add_edge(checker, publisher, condition=_is(Done))
            .build()
        )

    async def process(self, req: MomentRequest) -> Overlay:
        t = _Timer()
        try:
            result = await asyncio.wait_for(
                self.build().run(req), timeout=self.budget_s
            )
            outputs = result.get_outputs()
            if outputs:
                return outputs[-1]
            note, status = "workflow produced no output", "error"
        except TimeoutError:
            self.breaker.failure()
            note, status = f"over {self.budget_s:g}s budget", "timeout"
        except Exception as e:  # noqa: BLE001 - any model failure falls back
            self.breaker.failure()
            note, status = type(e).__name__, "error"
        trace = [TraceStep(agent="engine", ms=t.ms, status=status, note=note)]
        show = float(req.event.get("importance", 0)) >= ON_AIR_IMPORTANCE
        return assemble(req, trace, show, None, None)

    async def recap(self, req: RecapRequest) -> Recap:
        # Recaps are longer than overlays and not on the live path: allow a bigger budget.
        budget = max(self.budget_s * 4, 10.0)
        return await write_recap(
            req, self.recap_editor, self.memory, self.breaker, budget
        )
