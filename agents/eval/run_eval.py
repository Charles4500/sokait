"""Evaluate the agent team on the key moments of a synthetic match.

1. Live run: every key moment through the real model (agents/.env), narrated for two
   audiences. Reports how often narration passes the Fact-Checker first time, is
   repaired, or falls back, plus latency and tokens.
2. Fault injection (offline, free): the narrator invents a number in half of its first
   drafts. Reports how many the Fact-Checker catches and how many the repair loop fixes.

    cd web && bun scripts/export-moments.ts 3 ../agents/eval/moments.json
    cd agents && uv run python eval/run_eval.py            # writes docs/EVAL.md
    uv run python eval/run_eval.py --offline-only          # no model calls
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import statistics
import sys
import time
from collections import Counter
from pathlib import Path

from agent_framework import ChatResponse, Message
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
load_dotenv(ROOT / ".env")

from pitchpulse_agents.clients import backend_name
from pitchpulse_agents.facts import numbers_in
from pitchpulse_agents.models import MomentRequest, NarrationOut
from pitchpulse_agents.offline import OfflineChatClient
from pitchpulse_agents.workflow import InsightsEngine

SEGMENTS = [
    {"persona": "casual", "language": "English", "favourite_club": "Thames Rovers"},
    {"persona": "audio", "language": "Swahili", "favourite_club": "Mersey Athletic"},
]
LIVE_GAP_S = 2.5  # spread calls out like a real match, and stay inside rate limits


def load(path: Path) -> list[MomentRequest]:
    raw = json.loads(path.read_text())
    return [MomentRequest.model_validate({**m, "segments": SEGMENTS}) for m in raw]


def pct(n: int, d: int) -> str:
    return f"{100 * n / d:.0f}%" if d else "n/a"


async def live_run(moments: list[MomentRequest]) -> dict:
    engine = InsightsEngine(budget_s=8)  # generous: measure the model, not the budget
    statuses: Counter[str] = Counter()
    latencies, numbers_checked, analyst_ok = [], 0, 0
    examples: list[tuple[str, str, str]] = []
    for m in moments:
        t = time.perf_counter()
        ov = await engine.process(m)
        latencies.append(time.perf_counter() - t)
        analyst_ok += any(
            s.agent == "analyst" and s.status in ("ok", "retry") for s in ov.trace
        )
        for n in ov.narrations:
            statuses[n.verification.status] += 1
            if n.verification.status != "fallback":
                numbers_checked += len(numbers_in(n.text))
                if len(examples) < 4 and m.event.get("type") in ("goal", "shot"):
                    examples.append((m.event["label"], n.segment.language, n.text))
        await asyncio.sleep(LIVE_GAP_S)
    q = statistics.quantiles(latencies, n=20) if len(latencies) > 1 else latencies * 19
    return {
        "moments": len(moments),
        "narrations": sum(statuses.values()),
        "statuses": statuses,
        "analyst_ok": analyst_ok,
        "p50": statistics.median(latencies),
        "p95": q[18],
        "numbers_checked": numbers_checked,
        "tokens": engine.budget.stats()["day_used"],
        "examples": examples,
    }


class InventsNumbers(OfflineChatClient):
    """Offline model whose first narration draft for every other moment contains a
    number that is not in the match data."""

    def __init__(self) -> None:
        super().__init__()
        self.injected = 0

    async def _respond(self, messages, options):
        payload = json.loads(messages[-1].text or "{}")
        # Agents never see engine ids, so pick moments by minute (even minutes).
        first_draft = "feedback" not in payload
        even_minute = int(payload.get("event", {}).get("minute", 0)) % 2 == 0
        if (
            options.get("response_format") is NarrationOut
            and first_draft
            and even_minute
        ):
            self.injected += 1
            actor = payload["event"].get("player", "He")
            text = f"{actor} has now run 13.7 km, a season high of 99 sprints!"
            return ChatResponse(
                messages=[Message("assistant", [json.dumps({"text": text})])]
            )
        return await super()._respond(messages, options)


async def fault_injection(moments: list[MomentRequest]) -> dict:
    client = InventsNumbers()
    engine = InsightsEngine(client, budget_s=5)
    statuses: Counter[str] = Counter()
    leaked = 0
    for m in moments:
        ov = await engine.process(m)
        for n in ov.narrations:
            statuses[n.verification.status] += 1
            if re.search(r"\b(13\.7|99)\b", n.text):
                leaked += 1
    return {"injected": client.injected, "statuses": statuses, "leaked": leaked}


def report(live: dict | None, faults: dict, seed_note: str) -> str:
    lines = ["# Evaluation", "", seed_note, ""]
    if live:
        s, total = live["statuses"], live["narrations"]
        lines += [
            (
                f"## Live run ({backend_name()}, {live['moments']} key moments × "
                f"{len(SEGMENTS)} audiences)"
            ),
            "",
            "| Metric | Result |",
            "|---|---|",
            f"| Analyst produced a grounded insight | {pct(live['analyst_ok'], live['moments'])} |",
            f"| Narration verified first time | {pct(s['pass'], total)} |",
            f"| Repaired by the Fact-Checker loop | {pct(s['repaired'], total)} |",
            f"| Fell back to the deterministic explanation | {pct(s['fallback'], total)} |",
            (
                f"| Numbers in aired AI text checked against match data | {live['numbers_checked']} "
                "(every one, by construction) |"
            ),
            f"| Latency per moment, p50 / p95 | {live['p50']:.2f} s / {live['p95']:.2f} s |",
            (
                f"| Tokens per moment (all agents, both audiences) | "
                f"{live['tokens'] // max(1, live['moments']):,} |"
            ),
            "",
            "Example narration:",
            "",
        ]
        lines += [
            f"- **{label}** ({lang}): {text}" for label, lang, text in live["examples"]
        ]
        lines.append("")
    f = faults
    caught = f["injected"] - f["leaked"]
    lines += [
        "## Fault injection (offline)",
        "",
        "The narrator is forced to invent statistics in its first draft for every moment on an even minute.",
        "",
        "| Metric | Result |",
        "|---|---|",
        f"| Drafts with invented numbers | {f['injected']} |",
        f"| Caught by the Fact-Checker | {caught} ({pct(caught, f['injected'])}) |",
        f"| Invented numbers that reached the screen | {f['leaked']} |",
        (
            f"| Narrations repaired / fell back | {f['statuses']['repaired']} / "
            f"{f['statuses']['fallback']} |"
        ),
        "",
    ]
    return "\n".join(lines)


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--moments", default=str(ROOT / "eval" / "moments.json"))
    ap.add_argument("--out", default=str(ROOT.parent / "docs" / "EVAL.md"))
    ap.add_argument("--offline-only", action="store_true")
    args = ap.parse_args()
    moments = load(Path(args.moments))
    note = (
        f"Key moments exported from synthetic match seed 3 "
        f"(`web/scripts/export-moments.ts`): {len(moments)} moments, "
        f"{sum(m.event.get('type') == 'goal' for m in moments)} goals."
    )
    live = None if args.offline_only else await live_run(moments)
    faults = await fault_injection(moments)
    text = report(live, faults, note)
    Path(args.out).write_text(text)
    print(text)


if __name__ == "__main__":
    asyncio.run(main())
