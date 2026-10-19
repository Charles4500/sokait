# PitchPulse — Build plan to submission

Submissions close **Mon 27 Oct 2026**. Target: submit **Sun 26 Oct**, keeping the 27th as buffer.

Prize lines this plan aims at: Grand Prize, Best Use of Microsoft Foundry, Best Multi-Agent Orchestration. Best Azure Cloud Native is a stretch.

## Day 0 checks (Sat 18 Oct)

- [ ] **Azure access.** Run `az login` then `az account show`. No subscription? Options: Azure free account (comes with starter credit), Azure for Students, or hackathon-provided credits (check the hackathon site and Discord).
- [ ] **Foundry.** Create a Foundry project in a region that offers the chat model you want. Deploy one small, fast model for Narrator and Fact-Checker and one stronger model for Analyst and Recap.
- [ ] **Azure AI Speech** resource (free tier is enough for the demo).
- [ ] **Public GitHub repo.** `git init`, push to a public GitHub repo, and commit early and often.
- [ ] Read the rules on team size, judging region and video requirements.

## Schedule

| Day | Date   | Deliverable                                                                                                                                                                                    | Done when                                                                                         |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Sun 19 | **Foundry swap.** `narrative.functions.ts` and `/api/tts` call Foundry and Azure AI Speech. Keys stay server-side.                                                                             | Dashboard narration and voice work with only Azure keys set.                                      |
| 2   | Mon 20 | **One match, server-side.** Seeded RNG in `match-engine.ts`. A match session route streams events over SSE, and the dashboard consumes that stream instead of simulating locally.              | Two browser tabs show the same match. `?seed=42` replays it exactly.                              |
| 3   | Tue 21 | **Agent service skeleton** (`agents/`, Python, Agent Framework). `/moments` endpoint, typed `Insight` and overlay models, Producer → Analyst → Narrator.                                       | A curl with a sample moment returns narration plus a trace.                                       |
| 4   | Wed 22 | **Fact-Checker, retry and fallback.** Number and name extraction, LLM judge, one repair loop, time budget, circuit breaker. Unit tests on the checker.                                         | A narration with a deliberately wrong xG gets rejected, then repaired or falls back.              |
| 5   | Thu 23 | **Match memory and Recap Editor.** Aired insights, narrative threads, milestones. Half-time and full-time recaps per persona and language. Web app wired to the agent service.                 | The live dashboard shows agent narration end to end. Recap mentions threads from earlier moments. |
| 6   | Fri 24 | **Agent trace UI.** Per-overlay panel showing agents, timings, evidence, verification status and fallback badge. Updated `smie.overlay.v2` feed.                                               | A judge can see why each line was said.                                                           |
| 7   | Sat 25 | **Deploy and evaluate.** Both containers on Azure Container Apps, App Insights traces, Foundry evaluation run on a seeded match (groundedness, per-language quality), results table in README. | Public URL works. README shows eval numbers.                                                      |
| 8   | Sun 26 | **Ship.** Record a demo video under 2:00, write the pitch, polish the README, submit.                                                                                                          | Submitted.                                                                                        |
| 9   | Mon 27 | Buffer.                                                                                                                                                                                        | —                                                                                                 |

If you slip, cut in this order: Recap memory threads → Foundry evals → trace UI polish. **Never cut** the Foundry swap, the Fact-Checker or the deploy. Those carry the category and agentic scores.

## Demo video outline (under 2:00)

1. **0:00–0:15. Problem.** A scoreline says nothing about why the match turned.
2. **0:15–0:45. Live dashboard.** A key moment appears: instant overlay, then the AI upgrade. Switch Casual → Analyst: same moment, different story. Switch the language to Spanish, then turn voice on.
3. **0:45–1:15. Under the hood.** Open the agent trace: Analyst evidence → Narrator → Fact-Checker. Show a rejected-then-repaired line.
4. **1:15–1:35. Resilience.** Kill the model key and show the deterministic fallback still on air.
5. **1:35–1:55. Studio value.** The SSE overlay feed for broadcast partners, the recap, and the Azure architecture diagram.
6. **1:55–2:00.** Name, repo URL.

Use no copyrighted music and no real club branding. The hero and MVP images must be ones you own or are free to use, so check `web/src/assets/`.

## Pitch draft

> PitchPulse is a multi-agent match insights engine on Azure. It ingests synthetic football events live, computes explainable stats, and uses a team of Microsoft Agent Framework agents on Foundry models to choose the moments that matter, explain why, and narrate them for every fan: analyst or casual, any language, favourite club or player. A Fact-Checker agent grounds every line in computed evidence before it airs, and a deterministic fallback keeps the broadcast running if AI fails. Overlays stream as timed, machine-readable JSON with full provenance, ready for studio graphics partners.

## Known gaps in the current code

- The match is simulated per browser with unseeded `Math.random`. Fixed on day 2.
- Win probability uses goal difference only. It should use xG, time remaining and momentum, and explain itself.
- Player distance is derived from touch count (`touches × 0.38`). Simulate positions or run distance per event.
- Stats are computed over the whole match. Add per-window stats (last 5 and last 10 minutes) so the Analyst can spot shifts.
- The README needs eval results and the demo video link before submission.
