# PitchPulse agents

Multi-agent service that turns a key match moment into verified, personalised overlay text.
Built with [Microsoft Agent Framework](https://github.com/microsoft/agent-framework).
See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for the full design.

```
Producer → Analyst → Narrator ⇄ Fact-Checker → Publisher
```

| Executor | Job |
|---|---|
| Producer | On-air gate, circuit breaker, loads match memory |
| Analyst (LLM) | One insight per moment, citing evidence by key from the facts table |
| Narrator (LLM) | Overlay text per audience segment (persona × language × favourite player), in parallel |
| Fact-Checker | Rejects narration containing numbers that are not in the match data; one repair loop |
| Publisher | Builds the `smie.overlay.v2` overlay, falls back per segment, records match memory |

Every failure path (bad evidence, invented numbers, model errors, timeouts) still ends in
an overlay, using the deterministic explanation the web app sent.

## Run

```sh
uv sync
uv run uvicorn pitchpulse_agents.server:app --reload --port 8000
uv run pytest
```

## Voices

Spoken commentary uses [Piper](https://github.com/OHF-Voice/piper1-gpl) neural voices,
free and running on the CPU. Download them once (about 360 MB):

```sh
for v in en_GB-northern_english_male-medium sw_CD-lanfrica-medium es_ES-davefx-medium \
         fr_FR-siwis-medium ar_JO-kareem-medium pt_BR-faber-medium; do
  uv run python -m piper.download_voices --download-dir voices "$v"
done
```

The Docker image downloads them at build time. `POST /tts` returns WAV audio.

## Model backend

Chosen from the environment, in this order:

| Backend | Variables |
|---|---|
| Microsoft Foundry | `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL` (auth via `DefaultAzureCredential`, e.g. `az login`) |
| OpenAI-compatible | `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, `OPENAI_MODEL` |
| Offline | nothing set: deterministic rule-based client, no network. English templates only. |

Other settings: `MOMENT_BUDGET_S` (default 4), `AGENTS_TOKEN` (require `Authorization: Bearer <token>`).

## API

- `GET /healthz`: backend, circuit breaker state, time budget.
- `POST /moments`: body is a `MomentRequest` (see `src/pitchpulse_agents/models.py`), returns an `Overlay`.
  Interactive docs at `/docs`.
