import json

from agent_framework import ChatResponse, Message

from pitchpulse_agents.ask import FALLBACK
from pitchpulse_agents.models import AskRequest
from pitchpulse_agents.offline import OfflineChatClient
from pitchpulse_agents.workflow import InsightsEngine

from .conftest import make_moment


def ask_request(**kw) -> AskRequest:
    m = make_moment()
    return AskRequest.model_validate(
        {
            "match_id": "main",
            "moment_id": "1:57",
            "minute": 63,
            "score": m.score,
            "stats": m.stats,
            "teams": {k: v.model_dump() for k, v in m.teams.items()},
            "segment": {"persona": "audio", "language": "English"},
            "question": "Who is winning?",
            "recent_events": ["63' Theo Quinn shot · xG 0.42"],
            "extra": {"players": {"Theo Quinn": {"touches": 31}}},
            **kw,
        }
    )


async def test_answer_uses_only_match_numbers():
    a = await InsightsEngine(OfflineChatClient(), budget_s=5).ask(ask_request())
    assert a.verification.status == "pass"
    assert "Thames Rovers 1" in a.answer and "minute 63" in a.answer


async def test_invented_number_in_an_answer_is_repaired_or_dropped():
    class Liar(OfflineChatClient):
        async def _respond(self, messages, options):
            body = {"answer": "Quinn has run 13.7 km today."}
            return ChatResponse(messages=[Message("assistant", [json.dumps(body)])])

    a = await InsightsEngine(Liar(), budget_s=5).ask(ask_request())
    assert a.verification.status == "fallback"
    assert a.answer == FALLBACK
    assert "number 13.7 is not in the match data" in a.verification.issues


async def test_extra_context_numbers_may_be_quoted():
    class Quoter(OfflineChatClient):
        async def _respond(self, messages, options):
            body = {"answer": "Theo Quinn has 31 touches."}
            return ChatResponse(messages=[Message("assistant", [json.dumps(body)])])

    a = await InsightsEngine(Quoter(), budget_s=5).ask(ask_request())
    assert a.verification.status == "pass"


async def test_audio_persona_says_where_play_is():
    event = {**make_moment().event, "where": "on the edge of the box, left side"}
    m = make_moment(event=event, segments=[{"persona": "audio"}])
    ov = await InsightsEngine(OfflineChatClient(), budget_s=5).process(m)
    assert "on the edge of the box, left side" in ov.narrations[0].text
    assert ov.narrations[0].verification.status == "pass"
