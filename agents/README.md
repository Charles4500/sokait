# Sokait agents

Multi-agent service that turns a key match moment into verified, personalised overlay text.
Built with [Microsoft Agent Framework](https://github.com/microsoft/agent-framework).
See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the full design.

```
Producer → Analyst → Narrator ⇄ Fact-Checker → Publisher
```

| Executor       | Job                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------- |
| Producer       | On-air gate, token budget, circuit breaker, loads match memory                               |
| Analyst (LLM)  | One insight per moment, citing evidence by key from the facts table; shared by all viewers   |
| Narrator (LLM) | Commentator-style overlay text per audience segment, in parallel; cached per segment         |
| Fact-Checker   | Numbers must be in the match data, the player named exactly, overlays short; one repair loop |
| Publisher      | Builds the `smie.overlay.v2` overlay, falls back per segment, records match memory           |

Also: a **Recap Editor** (`POST /recap`) and a **Match Q&A** agent (`POST /ask`) for
spoken questions, both fact-checked. Each role can use a list of models that fail over
on rate limits (`OPENAI_MODEL_<ROLE>`).

Every failure path (bad evidence, invented numbers, model errors, timeouts) still ends in
an overlay, using the deterministic explanation the web app sent.

## Run

```sh
uv sync
uv run uvicorn sokait_agents.server:app --reload --port 8000
uv run pytest
```

## Model backend

Chosen from the environment, in this order:

| Backend           | Variables                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Microsoft Foundry | `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL` (auth via `DefaultAzureCredential`, e.g. `az login`) |
| OpenAI-compatible | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL`                                     |
| Offline           | nothing set: deterministic rule-based client, no network. English templates only.                |

Other settings: `MOMENT_BUDGET_S` (default 4), `AGENTS_TOKEN` (require `Authorization: Bearer <token>`).

## API

- `GET /healthz`: backend, circuit breaker state, time budget.
- `POST /moments`: body is a `MomentRequest` (see `src/sokait_agents/models.py`), returns an `Overlay`.
  Interactive docs at `/docs`.
