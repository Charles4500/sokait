"""Pick the chat client every agent uses, from the environment.

1. Microsoft Foundry   FOUNDRY_PROJECT_ENDPOINT + FOUNDRY_MODEL (auth: DefaultAzureCredential)
2. OpenAI-compatible   OPENAI_API_KEY (+ OPENAI_BASE_URL, OPENAI_MODEL), e.g. Groq or a
                       local model. OPENAI_MODEL_<ROLE> (ANALYST, NARRATOR, RECAP) picks a
                       model per agent; OPENAI_REASONING_EFFORT tunes reasoning models.
3. Offline             nothing set: deterministic rule-based client, no network
"""

from __future__ import annotations

import os
from typing import Any


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

        return OpenAIChatCompletionClient(
            model=role_model(role),
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.getenv("OPENAI_BASE_URL"),
        )
    from .offline import (
        OfflineChatClient,  # local: offline imports recap, which imports us
    )

    return OfflineChatClient()


def role_model(role: str | None) -> str:
    default = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    return os.getenv(f"OPENAI_MODEL_{role.upper()}", default) if role else default


def run_options(response_format: type) -> dict[str, Any]:
    """Per-call options: structured output, plus reasoning effort when configured."""
    options: dict[str, Any] = {"response_format": response_format}
    if effort := os.getenv("OPENAI_REASONING_EFFORT"):
        options["reasoning_effort"] = effort
    return options
