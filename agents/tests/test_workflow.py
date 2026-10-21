import asyncio
import json

from agent_framework import ChatResponse, Message

from pitchpulse_agents.models import Insight, NarrationOut
from pitchpulse_agents.offline import OfflineChatClient
from pitchpulse_agents.workflow import InsightsEngine

from .conftest import make_moment


def agents_in(overlay):
    return [(s.agent, s.status) for s in overlay.trace]


class ScriptedNarrator(OfflineChatClient):
    """Offline analyst, but the narrator replies from a script (one entry per call)."""

    def __init__(self, script):
        super().__init__()
        self.script = list(script)

    async def _respond(self, messages, options):
        if options.get("response_format") is NarrationOut:
            self.calls += 1
            text = self.script.pop(0) if len(self.script) > 1 else self.script[0]
            return ChatResponse(
                messages=[Message("assistant", [json.dumps({"text": text})])]
            )
        return await super()._respond(messages, options)


class BrokenModel(OfflineChatClient):
    async def _respond(self, messages, options):
        raise ConnectionError("model down")


class SlowModel(OfflineChatClient):
    async def _respond(self, messages, options):
        await asyncio.sleep(1)
        return await super()._respond(messages, options)


async def test_key_moment_runs_the_full_agent_pipeline(moment):
    ov = await InsightsEngine(OfflineChatClient(), budget_s=5).process(moment)
    assert ov.show and not ov.fallback
    assert ov.insight.category == "chance_quality"
    assert ov.insight.evidence[0].stat == "event.xg"
    assert agents_in(ov) == [
        ("producer", "ok"),
        ("analyst", "ok"),
        ("narrator", "ok"),
        ("fact_checker", "ok"),
    ]
    assert [n.verification.status for n in ov.narrations] == ["pass", "pass", "pass"]
    assert ov.narrations[2].text.startswith("Eyes on Eli Mensah")
    assert ov.model_dump(by_alias=True)["schema"] == "smie.overlay.v2"


async def test_quiet_moment_skips_ai_entirely():
    client = OfflineChatClient()
    m = make_moment(event={**make_moment().event, "type": "pass", "importance": 0.15})
    ov = await InsightsEngine(client, budget_s=5).process(m)
    assert not ov.show and ov.fallback
    assert agents_in(ov) == [("producer", "skipped")]
    assert client.calls == 0


async def test_favourite_player_moment_airs_for_player_focus():
    e = {
        **make_moment().event,
        "type": "pass",
        "importance": 0.3,
        "player": "Eli Mensah",
    }
    ov = await InsightsEngine(OfflineChatClient(), budget_s=5).process(
        make_moment(event=e)
    )
    assert ov.show


async def test_invented_number_is_rejected_then_repaired(moment):
    client = ScriptedNarrator(
        ["An xG of 0.77, unbelievable!", "A 0.42 xG chance for Quinn."]
    )
    m = make_moment(segments=[{"persona": "casual"}])
    ov = await InsightsEngine(client, budget_s=5).process(m)
    n = ov.narrations[0]
    assert n.verification.status == "repaired" and n.verification.attempts == 2
    assert n.text == "A 0.42 xG chance for Quinn."
    assert ("fact_checker", "retry") in agents_in(ov)
    assert ("narrator", "retry") in agents_in(ov)


async def test_narrator_that_keeps_inventing_falls_back(moment):
    client = ScriptedNarrator(["Quinn has scored 9 this season."])
    m = make_moment(segments=[{"persona": "casual"}])
    ov = await InsightsEngine(client, budget_s=5).process(m)
    n = ov.narrations[0]
    assert n.verification.status == "fallback"
    assert n.text == m.fallback_text
    assert n.verification.issues == ["number 9 is not in the match data"]
    assert ov.fallback


async def test_model_outage_falls_back_and_trips_the_breaker(moment):
    engine = InsightsEngine(BrokenModel(), budget_s=5)
    for _ in range(3):
        ov = await engine.process(moment)
        assert ov.fallback and ov.show
        assert ("analyst", "error") in agents_in(ov)
    assert engine.breaker.is_open
    ov = await engine.process(moment)
    assert agents_in(ov) == [("producer", "skipped")]
    assert "circuit open" in ov.trace[0].note


async def test_time_budget_is_enforced(moment):
    ov = await InsightsEngine(SlowModel(), budget_s=0.2).process(moment)
    assert ov.fallback
    assert agents_in(ov) == [("engine", "timeout")]
    assert all(n.text == moment.fallback_text for n in ov.narrations)


async def test_match_memory_feeds_recent_insights_to_the_analyst():
    seen = []

    class Spy(OfflineChatClient):
        async def _respond(self, messages, options):
            if options.get("response_format") is Insight:
                seen.append(json.loads(messages[-1].text)["recent_insights"])
            return await super()._respond(messages, options)

    engine = InsightsEngine(Spy(), budget_s=5)
    await engine.process(make_moment(moment_id="1:10"))
    await engine.process(make_moment(moment_id="1:11"))
    assert seen[0] == []
    assert seen[1][0]["category"] == "chance_quality"
    # A restarted match (new gen) starts with empty memory.
    await engine.process(make_moment(moment_id="2:1"))
    assert seen[2] == []


def recap_request(**kw):
    m = make_moment()
    from pitchpulse_agents.models import RecapRequest

    return RecapRequest.model_validate(
        {
            "match_id": "main",
            "moment_id": "1:90",
            "minute": 64,
            "score": m.score,
            "stats": m.stats,
            "teams": {k: v.model_dump() for k, v in m.teams.items()},
            "segment": {"persona": "analyst"},
            "key_moments": ["63' Theo Quinn shot · xG 0.42"],
            "mvp": "Eli Mensah",
            **kw,
        }
    )


async def test_recap_uses_only_known_numbers():
    engine = InsightsEngine(OfflineChatClient(), budget_s=5)
    r = await engine.recap(recap_request())
    assert r.verification.status == "pass"
    assert r.headline == "Thames Rovers lead 1-0 after 64 minutes"
    assert any("0.42" in b for b in r.bullets)


async def test_recap_with_invented_stats_falls_back_to_plain_recap():
    class Liar(OfflineChatClient):
        async def _respond(self, messages, options):
            body = {"headline": "A 4-0 rout", "bullets": ["Quinn ran 13.7 km."]}
            return ChatResponse(messages=[Message("assistant", [json.dumps(body)])])

    r = await InsightsEngine(Liar(), budget_s=5).recap(recap_request())
    assert r.verification.status == "fallback"
    assert "number 13.7 is not in the match data" in r.verification.issues
    assert r.headline == "Thames Rovers lead 1-0 after 64 minutes"
