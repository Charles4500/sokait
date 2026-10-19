"""Facts table and the deterministic half of fact-checking.

Every number an agent may say comes from here. The Analyst cites facts by key,
and the checker rejects narration that contains numbers not in the table.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

from .models import Evidence, MomentRequest, RecapRequest

Facts = dict[str, float | str]

# Numbers that are safe in any sentence ("one of the two sides", "first half").
_SAFE_NUMBERS = {0.0, 1.0, 2.0, 45.0, 90.0}
_NUMBER = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?(?![\w])")


def _flatten(prefix: str, value: Any, out: Facts) -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            _flatten(f"{prefix}.{k}" if prefix else str(k), v, out)
    elif isinstance(value, bool):
        out[prefix] = str(value).lower()
    elif isinstance(value, (int, float)):
        out[prefix] = float(value)
    elif isinstance(value, str):
        out[prefix] = value


def build_facts(req: MomentRequest) -> Facts:
    facts: Facts = {}
    _flatten("", req.stats, facts)
    _flatten("event", req.event, facts)
    _flatten("score", req.score, facts)
    facts["minute"] = float(req.minute)
    for side, team in req.teams.items():
        facts[f"team.{side}.name"] = team.name
        facts[f"team.{side}.short"] = team.short
    return facts


def build_recap_facts(req: RecapRequest, aired: list[dict]) -> Facts:
    """Stats plus every number already published in key moments and aired insights."""
    facts: Facts = {}
    _flatten("", req.stats, facts)
    _flatten("score", req.score, facts)
    facts["minute"] = float(req.minute)
    for i, line in enumerate(req.key_moments):
        for j, n in enumerate(numbers_in(line)):
            facts[f"moment.{i}.{j}"] = n
    for i, a in enumerate(aired):
        for j, ev in enumerate(a.get("evidence", [])):
            if isinstance(ev.get("value"), (int, float)):
                facts[f"aired.{i}.{j}"] = float(ev["value"])
    return facts


def check_evidence(evidence: list[Evidence], facts: Facts) -> list[str]:
    """Analyst citations must point at real keys with the real value."""
    issues = []
    for ev in evidence:
        if ev.stat not in facts:
            issues.append(f"unknown stat '{ev.stat}'")
            continue
        actual = facts[ev.stat]
        if isinstance(actual, float):
            try:
                if abs(float(ev.value) - actual) > max(0.011, abs(actual) * 0.01):
                    issues.append(f"{ev.stat} is {_fmt(actual)}, not {ev.value}")
            except (TypeError, ValueError):
                issues.append(f"{ev.stat} should be a number")
        elif str(ev.value).strip().lower() != actual.lower():
            issues.append(f"{ev.stat} is '{actual}', not '{ev.value}'")
    return issues


def _normalise_digits(text: str) -> str:
    # Arabic-Indic and other script digits → ASCII, so every language is checkable.
    text = text.replace("٫", ".")  # Arabic decimal separator
    return "".join(
        str(unicodedata.digit(ch)) if ch.isdigit() and not ch.isascii() else ch
        for ch in text
    )


def numbers_in(text: str) -> list[float]:
    return [
        float(m.replace(",", ".")) for m in _NUMBER.findall(_normalise_digits(text))
    ]


def check_numbers(text: str, facts: Facts) -> list[str]:
    """Every number in the narration must exist in the facts table (or be trivially safe)."""
    known = {round(v, 2) for v in facts.values() if isinstance(v, float)}
    # Allow percentages written from 0..1 values (xG 0.42 → "42%") and vice versa.
    known |= {round(v * 100, 2) for v in list(known) if 0 < v <= 1}
    issues = []
    for n in numbers_in(text):
        if n in _SAFE_NUMBERS or round(n, 2) in known:
            continue
        issues.append(f"number {_fmt(n)} is not in the match data")
    return issues


def _fmt(v: float) -> str:
    return f"{v:g}"
