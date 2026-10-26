"""Token budget: spend AI where it matters most when the model quota runs low.

Free model tiers cap tokens per minute and per day. The budget counts the tokens each
model call actually used, and the Producer asks it how important a moment must be to
deserve AI right now. As the budget fills, ordinary moments keep their deterministic
explanation and AI is saved for big chances and goals.
"""

from __future__ import annotations

import os
import time
from collections import deque
from collections.abc import Callable
from typing import Any

# (share of budget used, minimum importance for AI). Goals have importance 1.0.
POLICY = [(0.7, 0.6), (0.9, 0.7), (1.0, 0.95)]


class TokenBudget:
    def __init__(
        self,
        per_minute: int | None = None,
        per_day: int | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.per_minute = per_minute or int(os.getenv("TOKENS_PER_MINUTE", "14000"))
        self.per_day = per_day or int(os.getenv("TOKENS_PER_DAY", "350000"))
        self._clock = clock
        self._recent: deque[tuple[float, int]] = deque()
        self._day = self._today()
        self._day_used = 0

    def _today(self) -> int:
        return int(self._clock() // 86400)  # UTC day, like provider quotas

    def add(self, tokens: int) -> None:
        if self._today() != self._day:
            self._day, self._day_used = self._today(), 0
        self._day_used += tokens
        self._recent.append((self._clock(), tokens))

    def record(self, response: Any) -> None:
        """Count the tokens a model call used (agent_framework response usage)."""
        usage = getattr(response, "usage_details", None) or {}
        tokens = usage.get("total_token_count") if hasattr(usage, "get") else None
        if isinstance(tokens, int) and tokens > 0:
            self.add(tokens)

    def _minute_used(self) -> int:
        cutoff = self._clock() - 60
        while self._recent and self._recent[0][0] < cutoff:
            self._recent.popleft()
        return sum(t for _, t in self._recent)

    def pressure(self) -> float:
        """Share of the tighter budget already used (1.0 = spent)."""
        if self._today() != self._day:
            self._day, self._day_used = self._today(), 0
        return max(self._minute_used() / self.per_minute, self._day_used / self.per_day)

    def min_importance(self) -> float | None:
        """How important a moment must be for AI now; None when the budget is spent."""
        p = self.pressure()
        for limit, importance in POLICY:
            if p < limit:
                return importance
        return None

    def stats(self) -> dict[str, Any]:
        return {
            "minute_used": self._minute_used(),
            "per_minute": self.per_minute,
            "day_used": self._day_used,
            "per_day": self.per_day,
            "pressure": round(self.pressure(), 3),
            "min_importance": self.min_importance(),
        }
