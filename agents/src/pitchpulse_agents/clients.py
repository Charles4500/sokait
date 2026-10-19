"""Pick the chat client every agent uses, from the environment.

1. Microsoft Foundry   FOUNDRY_PROJECT_ENDPOINT + FOUNDRY_MODEL (auth: DefaultAzureCredential)
2. OpenAI-compatible   OPENAI_API_KEY (+ OPENAI_BASE_URL, OPENAI_MODEL), e.g. a local model
3. Offline             nothing set: deterministic rule-based client, no network
"""

from __future__ import annotations

import os
from typing import Any

from .offline import OfflineChatClient


def backend_name() -> str:
    if os.getenv("FOUNDRY_PROJECT_ENDPOINT"):
        return "foundry"
    if os.getenv("OPENAI_API_KEY"):
        return "openai-compatible"
    return "offline"


def make_chat_client() -> Any:
    backend = backend_name()
    if backend == "foundry":
        from agent_framework.foundry import FoundryChatClient
        from azure.identity.aio import DefaultAzureCredential

        # Endpoint and model deployment are read from FOUNDRY_PROJECT_ENDPOINT / FOUNDRY_MODEL.
        return FoundryChatClient(credential=DefaultAzureCredential())
    if backend == "openai-compatible":
        from agent_framework.openai import OpenAIChatCompletionClient

        return OpenAIChatCompletionClient(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            api_key=os.environ["OPENAI_API_KEY"],
            base_url=os.getenv("OPENAI_BASE_URL"),
        )
    return OfflineChatClient()
