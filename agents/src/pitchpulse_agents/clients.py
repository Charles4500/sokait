"""Pick the chat client every agent uses, from the environment.

1. Microsoft Foundry   FOUNDRY_PROJECT_ENDPOINT + FOUNDRY_MODEL (auth: DefaultAzureCredential)
2. OpenAI-compatible   OPENAI_API_KEY (+ OPENAI_BASE_URL, OPENAI_MODEL), e.g. Groq or a
                       local model. OPENAI_MODEL_<ROLE> (ANALYST, NARRATOR, RECAP, QA) picks
                       models per agent: a comma-separated list fails over in order when a
                       model is rate-limited. OPENAI_REASONING_EFFORT tunes reasoning models.
3. Offline             nothing set: deterministic rule-based client, no network
"""

from __future__ import annotations

import os
import re
import time
from collections.abc import Mapping, Sequence
from typing import Any

from agent_framework import BaseChatClient, ChatResponse, Message


def backend_name() -> str:
    if os.getenv("FOUNDRY_PROJECT_ENDPOINT"):
        return "foundry"
    if os.getenv("OPENAI_API_KEY"):
        return "openai-compatible"
    return "offline"


def make_chat_client(role: str | None = None) -> Any:
    backend = backend_name()
    if backend == "foundry":
        from agent_framework.foundry import FoundryChatClient
        from azure.identity.aio import DefaultAzureCredential

        # Endpoint and model deployment are read from FOUNDRY_PROJECT_ENDPOINT / FOUNDRY_MODEL.
        return FoundryChatClient(credential=DefaultAzureCredential())
    if backend == "openai-compatible":
        from agent_framework.openai import OpenAIChatCompletionClient
        from openai import AsyncOpenAI

        # No SDK-level retries: a rate-limited model should fail over at once, not wait
        # out our live time budget.
        sdk = AsyncOpenAI(
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.getenv("OPENAI_BASE_URL"),
            max_retries=0,
        )
        models = role_models(role)
        clients = [
            OpenAIChatCompletionClient(model=m, async_client=sdk) for m in models
        ]
        return clients[0] if len(clients) == 1 else FailoverChatClient(models, clients)
    from .offline import (
        OfflineChatClient,  # local: offline imports recap, which imports us
    )

    return OfflineChatClient()


def role_models(role: str | None) -> list[str]:
    default = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    raw = os.getenv(f"OPENAI_MODEL_{role.upper()}", default) if role else default
    return [m.strip() for m in raw.split(",") if m.strip()]


def rate_limit_wait(error: BaseException) -> float | None:
    """Seconds to rest a model if `error` is a rate limit (HTTP 429), else None."""
    chain: BaseException | None = error
    while chain is not None:
        if getattr(chain, "status_code", None) == 429 or "429" in str(chain)[:200]:
            text = str(chain)
            m = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", text)
            if m:
                return int(m.group(1) or 0) * 60 + float(m.group(2))
            return 60.0
        chain = chain.__cause__ or chain.__context__
    return None


class FailoverChatClient(BaseChatClient):
    """Tries each model in order. A rate-limited model rests for as long as the provider
    asks, and the next one takes over; free daily quotas are per model, so this also
    multiplies the budget."""

    def __init__(self, names: list[str], clients: list[Any], **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.names = names
        self.clients = clients
        self.resting_until: dict[str, float] = {}

    def _inner_get_response(
        self,
        *,
        messages: Sequence[Message],
        options: Mapping[str, Any],
        stream: bool = False,
        **kwargs: Any,
    ):
        return self._first_available(messages, options, kwargs)

    async def _first_available(
        self, messages: Sequence[Message], options: Mapping[str, Any], kwargs: dict
    ) -> ChatResponse:
        last: BaseException | None = None
        for name, client in zip(self.names, self.clients, strict=True):
            if time.monotonic() < self.resting_until.get(name, 0):
                continue
            try:
                return await client._inner_get_response(
                    messages=messages, options=options, stream=False, **kwargs
                )
            except Exception as e:
                wait = rate_limit_wait(e)
                if wait is None:
                    raise
                self.resting_until[name] = time.monotonic() + wait
                last = e
        raise last or RuntimeError("every model is resting after rate limits")


def run_options(response_format: type) -> dict[str, Any]:
    """Per-call options: structured output, plus reasoning effort when configured."""
    options: dict[str, Any] = {"response_format": response_format}
    if effort := os.getenv("OPENAI_REASONING_EFFORT"):
        options["reasoning_effort"] = effort
    return options
