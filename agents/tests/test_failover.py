import json

import pytest
from agent_framework import Agent, ChatResponse, Message

from pitchpulse_agents.clients import (
    FailoverChatClient,
    available_models,
    rate_limit_wait,
)
from pitchpulse_agents.offline import OfflineChatClient


class RateLimited(Exception):
    status_code = 429


GROQ_429 = (
    "Error code: 429 - Rate limit reached for model `openai/gpt-oss-20b` on tokens per "
    "day (TPD): Limit 200000, Used 199482. Please try again in 16m45.264s."
)


def test_wait_is_read_from_the_provider_message():
    assert rate_limit_wait(RateLimited(GROQ_429)) == pytest.approx(16 * 60 + 45.264)
    assert rate_limit_wait(RateLimited("slow down")) == 60.0
    assert rate_limit_wait(ValueError("bad request")) is None
    gemini = "Error code: 429 - [{'error': {'details': [{'retryDelay': '37s'}]}}]"
    assert rate_limit_wait(RateLimited(gemini)) == 37.0

    class Overloaded(Exception):
        status_code = 503

    assert rate_limit_wait(Overloaded("high demand")) == 30.0


def test_backup_provider_joins_only_with_a_key(monkeypatch):
    chain = "openai/gpt-oss-120b,gemini:gemini-3.5-flash"
    monkeypatch.setenv("OPENAI_MODEL_QA", chain)
    monkeypatch.setenv("OPENAI_API_KEY", "groq")
    assert available_models("qa") == [("OPENAI", "openai/gpt-oss-120b")]
    monkeypatch.setenv("GEMINI_API_KEY", "gemini")
    assert available_models("qa") == [
        ("OPENAI", "openai/gpt-oss-120b"),
        ("GEMINI", "gemini-3.5-flash"),
    ]
    monkeypatch.setenv("OPENAI_API_KEY", "")
    assert available_models("qa") == [("GEMINI", "gemini-3.5-flash")]


class Exhausted(OfflineChatClient):
    def __init__(self):
        super().__init__()

    async def _respond(self, messages, options):
        self.calls += 1
        raise RateLimited(GROQ_429)


class Answers(OfflineChatClient):
    async def _respond(self, messages, options):
        self.calls += 1
        return ChatResponse(
            messages=[Message("assistant", [json.dumps({"text": "hi"})])]
        )


async def test_rate_limited_model_rests_and_the_next_answers():
    first, second = Exhausted(), Answers()
    client = FailoverChatClient(["small", "large"], [first, second])
    agent = Agent(client, "test")
    assert (await agent.run("{}")).text == '{"text": "hi"}'
    assert (await agent.run("{}")).text == '{"text": "hi"}'
    assert first.calls == 1  # resting after the 429: not asked again
    assert second.calls == 2


async def test_other_errors_are_not_hidden():
    class Broken(OfflineChatClient):
        async def _respond(self, messages, options):
            raise ValueError("schema error")

    agent = Agent(FailoverChatClient(["a", "b"], [Broken(), Answers()]), "test")
    with pytest.raises(Exception, match="schema error"):
        await agent.run("{}")


async def test_all_models_resting_raises():
    agent = Agent(FailoverChatClient(["a", "b"], [Exhausted(), Exhausted()]), "test")
    with pytest.raises(Exception, match="429"):
        await agent.run("{}")
