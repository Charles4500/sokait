"""Match memory (shared state across moments) and the circuit breaker."""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from .models import Insight


@dataclass
class AiredInsight:
    moment_id: str
    minute: int
    insight: Insight


@dataclass
class MatchMemory:
    gen: str = ""
    aired: list[AiredInsight] = field(default_factory=list)
    lines: list[str] = field(default_factory=list)  # recent narration, to vary openers

    def recent(self, n: int = 5) -> list[dict]:
        return [{"minute": a.minute, **a.insight.model_dump()} for a in self.aired[-n:]]

    def said(self, text: str, keep: int = 6) -> None:
        self.lines.append(text)
        del self.lines[:-keep]


class MemoryStore:
    """In-process store keyed by match id. Swap for Redis to run several replicas."""

    def __init__(self, keep: int = 40) -> None:
        self._matches: dict[str, MatchMemory] = {}
        self._keep = keep

    def get(self, match_id: str, moment_id: str) -> MatchMemory:
        gen = moment_id.split(":", 1)[0]
        mem = self._matches.get(match_id)
        if mem is None or mem.gen != gen:  # new match or restarted match
            mem = self._matches[match_id] = MatchMemory(gen=gen)
        return mem

    def record(
        self, match_id: str, moment_id: str, minute: int, insight: Insight
    ) -> None:
        mem = self.get(match_id, moment_id)
        if any(a.moment_id == moment_id for a in mem.aired):
            return  # already recorded for another viewer of the same moment
        mem.aired.append(AiredInsight(moment_id, minute, insight))
        del mem.aired[: -self._keep]


class CircuitBreaker:
    """After `threshold` consecutive model failures, skip AI for `cooldown_s`."""

    def __init__(self, threshold: int = 3, cooldown_s: float = 60.0) -> None:
        self.threshold = threshold
        self.cooldown_s = cooldown_s
        self.failures = 0
        self.open_until = 0.0

    @property
    def is_open(self) -> bool:
        return time.monotonic() < self.open_until

    def success(self) -> None:
        self.failures = 0

    def failure(self) -> None:
        self.failures += 1
        if self.failures >= self.threshold:
            self.open_until = time.monotonic() + self.cooldown_s
            self.failures = 0
