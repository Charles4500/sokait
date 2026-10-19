# PitchPulse

A multi-agent match insights engine. PitchPulse ingests synthetic football events live, computes explainable stats, and uses a team of Microsoft Agent Framework agents to choose the moments that matter, explain why, and narrate them for every fan: analyst or casual, any language, favourite club or player. A Fact-Checker agent grounds every line in computed evidence before it airs, and a deterministic fallback keeps the broadcast running if AI fails.

All clubs, players and events are synthetic. No real league data is used.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Build plan: [docs/PLAN.md](docs/PLAN.md)
- Agent service: [agents/README.md](agents/README.md)

## Repository layout

```
web/                    TypeScript web app (TanStack Start, React, Tailwind)
  src/match/            Synthetic match engine, shared match hub, pitch geometry
  src/insights/         Calls to the agent service, key-moment logic, voice
  src/components/       Dashboard sections and the few shadcn/ui primitives used
  src/routes/           Pages and API routes (SSE match stream, partner feed)
  src/test/             Vitest tests
agents/                 Python agent service (Microsoft Agent Framework, FastAPI)
  src/pitchpulse_agents/  Agents, workflow, fact-checking, memory, model clients
  tests/                pytest tests (run offline, no model needed)
docs/                   Architecture and build plan
.github/workflows/      CI for both services
```

## How it fits together

| Part          | Where                                  | What it does                                                                                              |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Match engine  | `web/src/match/engine.ts`              | Seeded synthetic events and pure stats (xG, pass difficulty, pressure, control vs chaos, win probability) |
| Match hub     | `web/src/match/hub.ts`, `/api/match/*` | One shared live match on the server, streamed over SSE; `?seed=N` for a private, reproducible replay      |
| Agent service | `agents/` (Python)                     | Producer → Analyst → Narrator ⇄ Fact-Checker → Publisher, plus a Recap Editor                             |
| Dashboard     | `web/src/routes/index.tsx`             | Live overlays, personalisation, agent trace, recaps                                                       |
| Partner feed  | `/api/public/feed`                     | Machine-readable overlay stream for broadcast graphics partners                                           |

## Run locally

Web app (needs [Bun](https://bun.sh) or Node 22+):

```sh
cd web
bun install
bun run dev            # http://localhost:8080
```

Agent service (needs [uv](https://docs.astral.sh/uv/)):

```sh
cd agents
uv sync
uv run uvicorn pitchpulse_agents.server:app --port 8000
```

Without any model credentials the agent service uses its offline, rule-based client, so the full pipeline runs with no cloud account. See [agents/README.md](agents/README.md) for Microsoft Foundry settings.

## Configuration

| Variable                                    | Used by | Purpose                                               |
| ------------------------------------------- | ------- | ----------------------------------------------------- |
| `AGENTS_URL`                                | web app | Agent service URL (default `http://localhost:8000`)   |
| `AGENTS_TOKEN`                              | both    | Shared bearer token between web app and agent service |
| `PRODUCER_TOKEN`                            | web app | Required to pause or restart the shared match         |
| `MATCH_SEED`, `MATCH_TICK_MS`               | web app | Seed and pace of the shared match                     |
| `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL` | agents  | Microsoft Foundry model deployment                    |

## Tests

```sh
cd web && bun run test        # web app
cd agents && uv run pytest    # agent service
```

## Production build

```sh
cd web
bun run build          # Node server in .output/server/index.mjs
node .output/server/index.mjs
```
