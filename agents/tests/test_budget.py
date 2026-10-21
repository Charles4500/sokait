from pitchpulse_agents.budget import TokenBudget
from pitchpulse_agents.offline import OfflineChatClient
from pitchpulse_agents.workflow import InsightsEngine

from .conftest import make_moment


class Clock:
    def __init__(self):
        self.t = 1_000_000.0

    def __call__(self):
        return self.t


def test_ai_is_saved_for_bigger_moments_as_the_budget_fills():
    clock = Clock()
    b = TokenBudget(per_minute=1000, per_day=100_000, clock=clock)
    assert b.min_importance() == 0.6
    b.add(750)
    assert b.min_importance() == 0.7  # big chances and goals
    b.add(200)
    assert b.min_importance() == 0.95  # goals only
    b.add(100)
    assert b.min_importance() is None  # spent
    clock.t += 61  # the minute window rolls over
    assert b.min_importance() == 0.6


def test_daily_budget_resets_at_midnight_utc():
    clock = Clock()
    b = TokenBudget(per_minute=10**9, per_day=1000, clock=clock)
    b.add(1000)
    assert b.min_importance() is None
    clock.t += 86400
    assert b.min_importance() == 0.6


def test_usage_is_read_from_model_responses():
    from types import SimpleNamespace

    b = TokenBudget(per_minute=10_000, per_day=10_000)
    b.record(SimpleNamespace(usage_details={"total_token_count": 1234}))
    b.record(object())  # no usage: ignored
    assert b.stats()["day_used"] == 1234


async def test_tight_budget_keeps_ordinary_moments_deterministic():
    client = OfflineChatClient()
    engine = InsightsEngine(client, budget_s=5)
    engine.budget = TokenBudget(per_minute=1000, per_day=10**9)
    engine.budget.add(800)  # 80% used: only importance >= 0.7 gets AI
    m = make_moment(event={**make_moment().event, "importance": 0.65})
    ov = await engine.process(m)
    assert ov.show and ov.fallback and client.calls == 0
    assert "AI saved for bigger moments" in ov.trace[0].note
    goal = make_moment(
        moment_id="1:58", event={**make_moment().event, "importance": 1.0}
    )
    assert not (await engine.process(goal)).fallback


async def test_spent_budget_still_answers_with_the_plain_fallback():
    engine = InsightsEngine(OfflineChatClient(), budget_s=5)
    engine.budget = TokenBudget(per_minute=100, per_day=10**9)
    engine.budget.add(100)
    ov = await engine.process(
        make_moment(event={**make_moment().event, "importance": 1.0})
    )
    assert ov.fallback and "deterministic until it resets" in ov.trace[0].note
