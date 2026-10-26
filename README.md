# Sokait

**Live football intelligence that every fan can trust, see and hear.**

Sokait turns a stream of synthetic match events into explainable, personalised match
intelligence. A team of agents built on **Microsoft Agent Framework** decides which
moments matter, explains why with evidence from the stats, and narrates them like a live
commentator, for analysts, casual fans and player followers, in six languages. A
Fact-Checker agent verifies every number before it airs, so nothing invented reaches the
screen. And with **Sokait Listen**, blind and low-vision fans can follow the match
through spatial audio and spoken commentary.

All clubs, players and events are synthetic. No real league data is used.

> Demo video: _link added on submission_ · Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · Evaluation: [docs/EVAL.md](docs/EVAL.md)

## What it does

- **Matchday**: a six-club league plays a full season, three matches at a time. Pick a
  live match, see what's coming up, and choose the clubs you follow.
- **Live tactical view**: a top-down pitch shows passes, shots, pressing and goals as they
  happen, with shot map and heatmap views.
- **Commentary that explains**: every key moment gets an instant deterministic
  explanation, then verified AI commentary ("What a strike from Pike! That equaliser pulls
  the game back into balance…") shown under the pitch like a live comment.
- **Personalised**: casual fan, analyst or player focus; English, Swahili, Spanish, French,
  Arabic, Portuguese; favourite club and player; side-by-side Analyst vs Fan.
- **Live timeline**: scrub back, replay from any goal, pause your own view, rejoin live.
  Matches of clubs you follow stack up in the corner; a goal there pops up so you can
  switch. YouTube-style keyboard shortcuts (`?` lists them).
- **Sokait Listen**: spatial ball audio, earcons, spoken AI commentary and voice
  questions ("how is Mensah doing?"), with a screen-reader mode.
- **Ask the match**: a floating assistant (or `/`) answers typed or spoken questions;
  common ones on the device, the rest by a Match Q&A agent, fact-checked.
- **Recaps**: a Recap Editor agent writes fact-checked match recaps.
- **Transparent**: every insight shows how it was made: which agents ran, how long they
  took, the evidence used, and whether the text passed, was repaired or fell back.
- **Partner feed**: a versioned, machine-readable overlay stream for broadcast graphics.

## Why the agents are trustworthy

| Mechanism                                                                 | What it guarantees                                                                                |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Analyst cites evidence by key from a facts table, checked before use      | Insights are grounded in computed stats                                                           |
| Fact-Checker checks every number, the player's name and overlay length    | Invented numbers never air (28 of 28 injected hallucinations caught, see [EVAL.md](docs/EVAL.md)) |
| One repair loop, then a deterministic fallback per audience               | Something correct is always on screen                                                             |
| Shared cache: one analysis per moment, one narration per audience segment | Cost grows with segments, not viewers                                                             |
| Model failover, token budget and circuit breaker                          | Survives rate limits and outages; AI is saved for the biggest moments when the budget is tight    |

## Repository layout

```
web/                    TypeScript web app (TanStack Start, React, Tailwind, shadcn/ui)
  src/match/            Synthetic league and match engine, live match hub, pitch layout
  src/insights/         Calls to the agent service, key-moment logic, speech
  src/listen/           Sokait Listen: spatial audio, spoken commentary, voice Q&A
  src/components/       Dashboard sections and shadcn/ui primitives
  src/routes/           Matchday (/) and watch (/watch) pages; API routes (SSE streams,
                        matchday list, partner feed, TTS)
  scripts/              Evaluation export, demo seed finder, portrait generation
agents/                 Python agent service (Microsoft Agent Framework, FastAPI)
  src/sokait_agents/  Agents, workflow, Fact-Checker, memory, cache, budget, models
  eval/                 Evaluation harness (live run and fault injection)
voice/                  Speech service (Piper neural voices, GPL-3.0)
infra/                  Azure Container Apps deployment (Bicep)
docs/                   Architecture, evaluation, plan
.github/workflows/      CI for all three services
```

## Run locally

Needs [Bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/).

```sh
# 1. Agent service (port 8000). Without credentials it uses an offline, rule-based client.
cd agents && uv sync && cp .env.example .env    # optional: add a free Groq key
uv run uvicorn sokait_agents.server:app --port 8000

# 2. Voice service (port 8001), optional; see voice/README.md to download voices once
cd voice && uv sync && uv run uvicorn sokait_voice.server:app --port 8001

# 3. Web app (port 8080)
cd web && bun install && bun run dev
```

Open http://localhost:8080 and pick a match. On the watch page, press `?` for keyboard
shortcuts, and **Listen** in the header for the audio mode. Microsoft Edge has natural browser voices; other browsers use the
voice service.

## Configuration

| Variable                                                 | Used by     | Purpose                                                                                       |
| -------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`      | agents      | Any OpenAI-compatible provider (the demo uses Groq's free tier)                               |
| `OPENAI_MODEL_<ROLE>`                                    | agents      | Per-agent model lists (`ANALYST`, `NARRATOR`, `QA`, `RECAP`); comma-separated lists fail over |
| `GEMINI_API_KEY`                                         | agents      | Backup provider: `gemini:<model>` entries in the lists above                                  |
| `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL`              | agents      | Microsoft Foundry model deployment                                                            |
| `TOKENS_PER_MINUTE`, `TOKENS_PER_DAY`, `MOMENT_BUDGET_S` | agents      | Token budget and live time budget                                                             |
| `AGENTS_URL`, `AGENTS_TOKEN`                             | web, agents | Agent service URL and shared token                                                            |
| `VOICE_URL`, `VOICE_TOKEN`                               | web, voice  | Voice service URL and shared token                                                            |
| `MATCH_TICK_MS`, `MATCH_RESTART_MS`, `PRODUCER_TOKEN`    | web         | Match pace, restart after full time, producer controls                                        |

## Tests and evaluation

```sh
cd web && bun run test               # match engine, hub, fixtures, Listen descriptions
cd agents && uv run pytest           # workflow, Fact-Checker, cache, budget, failover, API
cd voice && uv run pytest            # speech API
cd agents && uv run python eval/run_eval.py   # writes docs/EVAL.md
```

CI runs type checks, linting, formatting, tests and container builds for every service.

## Deploy to Azure

Every service has a Dockerfile; `infra/main.bicep` runs them on Azure Container Apps (web
app public, agent and voice services internal). Push the three images, then:

```sh
export OPENAI_API_KEY=... GEMINI_API_KEY=... AGENTS_TOKEN=$(openssl rand -hex 24) VOICE_TOKEN=$(openssl rand -hex 24)
az group create -n sokait -l westeurope
az deployment group create -g sokait -f infra/main.bicep -p infra/main.bicepparam
```

Set `foundryProjectEndpoint` in `infra/main.bicepparam` to use Microsoft Foundry models
through the agent service's managed identity.

## Deploy as one container

`deploy/Dockerfile` runs the web app and the agent service in a single container (about
150 MB of RAM), for single-service hosts. The live demo runs on Render's free tier from
`render.yaml`: create a Blueprint from this repository and enter `OPENAI_API_KEY` and
`GEMINI_API_KEY` when asked. Build with `--build-arg WITH_VOICE=1` to include the voice
service as well (needs about 1.5 GB of RAM).

## Licence

`web/` and `agents/` are released under the [MIT licence](LICENSE). `voice/` is
GPL-3.0-or-later because it uses Piper; it runs as a separate service over HTTP. Player
portraits are generated with FLUX.1-schnell (Apache-2.0); club badges use DiceBear's CC0
styles.
