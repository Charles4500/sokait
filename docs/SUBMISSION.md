# Submission text

Copy into the hackathon form. Replace the two links before submitting.

---

## Project name

PitchPulse

## Tagline (one line)

Live football intelligence that every fan can trust, see and hear.

## Elevator pitch

Live match data tells fans _what_ happened, rarely _why_ it mattered, and almost never in
their language or in a form they can follow without seeing the screen. PitchPulse is a
multi-agent match intelligence engine built on **Microsoft Agent Framework**. It ingests
synthetic, football-realistic events from a six-club league playing live, computes
explainable stats in code, and lets a team of agents decide which moments matter, explain
why with evidence, and narrate them like a live commentator: for analysts, casual fans and
player followers, in six languages. A Fact-Checker agent verifies every number against the
match data before it airs, so nothing invented reaches the screen. With **PitchPulse
Listen**, blind and low-vision fans follow the match through spatial audio, spoken
commentary and voice questions, using just a phone and headphones.

## What it does

- **Matchday:** a six-club synthetic league plays a full season, three matches at a time.
  Fans pick a live match, see what's coming up, and choose clubs to follow.
- **Live tactical view** with shot map and heatmap, a broadcast-style lower third, a live
  commentary feed, a timeline with replay, and an EA FC-style player of the match card.
- **Agent commentary** that explains why each key moment matters, personalised by persona
  (analyst, casual fan, player focus, audio), language (English, Swahili, Spanish, French,
  Arabic, Portuguese), favourite club and favourite player.
- **Trust you can see:** every insight shows which agents ran, how long they took, the
  evidence they used, and whether the text passed the Fact-Checker, was repaired, or fell
  back to the deterministic explanation.
- **Ask the match:** a floating assistant on every screen answers typed or spoken
  questions. Common ones are answered instantly on the device; the rest go to the Match
  Q&A agent and show whether they passed the Fact-Checker.
- **PitchPulse Listen:** spatial ball audio (your club always attacks to your right),
  earcons for passes, shots and goals, spoken AI commentary, voice questions answered by a
  Match Q&A agent, and a screen-reader mode.
- **Recaps** by a Recap Editor agent, and a **partner feed** of versioned, machine-readable
  overlays for broadcast graphics.

## How we built it

**Microsoft Agent Framework (Python)** runs seven agents as a workflow: a Producer (on-air
decisions, token budget, circuit breaker), an Analyst (one evidence-backed insight per
moment), a Narrator (commentary per audience segment), a Fact-Checker (numbers, names,
length; one repair loop), a Publisher (provenance and fallbacks), a Recap Editor and a Match
Q&A agent. Executors are connected by conditional edges; the Fact-Checker → Narrator edge is
the repair loop, and every path, including every failure, ends with something correct on
screen.

The design rule is **numbers come from code, words come from agents**. A TypeScript engine
(TanStack Start, React) simulates the season and computes xG, pass difficulty, pressing,
control vs chaos and win probability; agents only select, explain and narrate those facts.

For scale and resilience: one analysis per moment shared by every viewer, narration cached
per audience segment, an ordered list of models per agent that fails over when one is
rate-limited, a token budget that saves AI for the biggest moments, and a circuit breaker.

**Models:** the agents run on any OpenAI-compatible endpoint or **Microsoft Foundry**
(`FOUNDRY_PROJECT_ENDPOINT`). The demo runs on Groq's free tier (gpt-oss-20b and 120b, with Gemini as a backup)
because the team has no Azure subscription. Speech uses Piper neural voices in a separate
service; player portraits were generated once with FLUX.1-schnell. All three services ship
as containers ready for Azure Container Apps.

## Evaluation

In fault-injection tests, the narrator was forced to invent statistics: the Fact-Checker
caught all 28 invented drafts and the repair loop fixed every one, so none reached the
screen. Results and the live-model run are in `docs/EVAL.md`.

## Challenges

- Keeping AI commentary trustworthy: we moved every number into code and made a checker
  verify every number, name and length before anything airs.
- Free-tier limits: per-model failover and a token budget keep the broadcast running when a
  model is rate-limited, and the deterministic explanation is always on screen first.
- Accessibility done properly: spatial audio, priority speech that never falls behind the
  match, on-device answers to common questions, and a screen-reader mode.

## What's next

Deploy to Azure Container Apps with Microsoft Foundry models and Azure AI Speech voices,
add Foundry evaluations to CI, and let a vision model replace the simulator as the event
source: the ingest stage is an interface, so nothing downstream changes.

## Microsoft technologies

- Microsoft Agent Framework (Python): agents, workflow, repair loop, structured output
- Microsoft Foundry: supported model backend
- Azure Container Apps: deployment target (Dockerfiles for every service)

## Links

- Code: https://github.com/Charles4500/pitchpulse
- Demo video: _add YouTube link_
