"""Pick the chat client every agent uses, from the environment.

1. Microsoft Foundry   FOUNDRY_PROJECT_ENDPOINT + FOUNDRY_MODEL (auth: DefaultAzureCredential)
2. OpenAI-compatible   OPENAI_API_KEY (+ OPENAI_BASE_URL, OPENAI_MODEL), e.g. Groq or a
                       local model. OPENAI_MODEL_<ROLE> (ANALYST, NARRATOR, RECAP, QA) picks
                       models per agent: a comma-separated list fails over in order when a
                       model is rate-limited. OPENAI_REASONING_EFFORT tunes reasoning models.
                       A "provider:model" entry uses <PROVIDER>_API_KEY / _BASE_URL instead,
                       e.g. "gemini:gemini-3.5-flash" with GEMINI_API_KEY as a backup that
                       has its own free quota. Entries without a key are skipped.
3. Offline             nothing set: deterministic rule-based client, no network
"""

from __future__ import annotations

import os
import re
import time
from collections.abc import Mapping, Sequence
from typing import Any

from agent_framework import BaseChatClient, ChatResponse, Message

# Known OpenAI-compatible providers and their default endpoints ("openai": OPENAI_BASE_URL).
PROVIDERS: dict[str, str | None] = {
    "OPENAI": None,
    "GEMINI": "https://generativelanguage.googleapis.com/v1beta/openai/",
}


def backend_name() -> str:
    if os.getenv("FOUNDRY_PROJECT_ENDPOINT"):
        return "foundry"
    if any(os.getenv(f"{p}_API_KEY") for p in PROVIDERS):
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

        sdks: dict[str, AsyncOpenAI] = {}

        def sdk(provider: str) -> AsyncOpenAI:
            # No SDK-level retries: a rate-limited model should fail over at once, not
            # wait out our live time budget.
            if provider not in sdks:
                sdks[provider] = AsyncOpenAI(
                    api_key=os.environ[f"{provider}_API_KEY"],
                    base_url=os.getenv(f"{provider}_BASE_URL") or PROVIDERS[provider],
                    max_retries=0,
                )
            return sdks[provider]

        entries = available_models(role)
        if not entries:
            raise RuntimeError(f"no model with an API key for role {role!r}")
        names = [f"{p.lower()}:{m}" if p != "OPENAI" else m for p, m in entries]
        clients = [
            OpenAIChatCompletionClient(model=m, async_client=sdk(p)) for p, m in entries
        ]
        return clients[0] if len(clients) == 1 else FailoverChatClient(names, clients)
    from .offline import (
        OfflineChatClient,  # local: offline imports recap, which imports us
    )

    return OfflineChatClient()


def role_models(role: str | None) -> list[str]:
    default = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    raw = os.getenv(f"OPENAI_MODEL_{role.upper()}", default) if role else default
    return [m.strip() for m in raw.split(",") if m.strip()]


def available_models(role: str | None) -> list[tuple[str, str]]:
    """(provider, model) for each entry of the role's list whose provider has a key."""
    out = []
    for entry in role_models(role):
        prefix, _, model = entry.partition(":")
        provider = prefix.upper()
        if (
            not model or provider not in PROVIDERS
        ):  # plain name, e.g. "openai/gpt-oss-20b"
            provider, model = "OPENAI", entry
        if os.getenv(f"{provider}_API_KEY"):
            out.append((provider, model))
    return out


def rate_limit_wait(error: BaseException) -> float | None:
    """Seconds to rest a model if `error` is a rate limit (HTTP 429) or the model is
    overloaded (HTTP 503), else None."""
    chain: BaseException | None = error
    while chain is not None:
        if getattr(chain, "status_code", None) == 503:
            return 30.0
        if getattr(chain, "status_code", None) == 429 or "429" in str(chain)[:200]:
            text = str(chain)
            m = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", text)
            if m:
                return int(m.group(1) or 0) * 60 + float(m.group(2))
            if m := re.search(r"retryDelay['\"]?:\s*['\"](\d+(?:\.\d+)?)s", text):
                return float(m.group(1))  # Gemini
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
