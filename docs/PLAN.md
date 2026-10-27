# Plan to submission

Submissions close **27 October 2026**. Target: submit on the 26th.

## Done

- [x] Synthetic league: three live fixtures, seeded, staggered, with pitch coordinates
- [x] Agent team on Microsoft Agent Framework: Producer, Analyst, Narrator, Fact-Checker,
      Publisher, Recap Editor, Match Q&A
- [x] Fact-Checker: numbers, names, overlay length; repair loop; deterministic fallback
- [x] Shared cache, model failover, token budget, circuit breaker
- [x] Dashboard: tactical pitch, lower third, live commentary, timeline and replay, Live
      now list, keyboard shortcuts, agent trace, recaps, player cards
- [x] Sokait Listen: spatial audio, spoken commentary, voice Q&A, screen-reader mode
- [x] Voice service (Piper) for natural speech in six languages
- [x] CI, git hooks, tests for every service; offline fault-injection evaluation

## Left

- [x] Realistic player portraits (FLUX.1-schnell on Cloudflare Workers AI)
- [x] Live evaluation run → `docs/EVAL.md`
- [x] Demo video under 2 minutes, uploaded to YouTube
- [ ] Make the repo public; decide on the commit email
- [x] Submission text: `docs/SUBMISSION.md` (add the video link)

## Demo video (under 2:00)

| Time | Shot                                                                                        |
| ---- | ------------------------------------------------------------------------------------------- |
| 0:00 | Problem: live stats don't tell fans _why_; most fans can't read xG; blind fans are left out |
| 0:10 | Matchday page: three live matches, what's coming up, follow your club; click Watch          |
| 0:18 | Goal: Nico Vargas scores, the commentator call, the lower third, the commentary feed        |
| 0:32 | Switch persona and language: same moment, Analyst vs Fan, then Swahili from the timeline    |
| 0:45 | "How the last insight was made": agent trace, evidence, the Fact-Checker verdict            |
| 0:58 | Ask the match: type a question, then ask one with the mic; the verified badge               |
| 1:10 | Timeline: jump back to the goal; Live now: switch to the other match your club follows      |
| 1:22 | Sokait Listen with headphones: spatial audio, the late winner called out loud               |
| 1:42 | Architecture in one frame: agents, Fact-Checker, Groq → Gemini failover, Agent Framework    |
| 1:55 | Close                                                                                       |

### The demo match

`/watch?seed=965` replays a fixed Thames Rovers vs Mersey Athletic, the same every time.
Seconds after the page opens: Vargas scores at **0:26** (12'), Mersey equalise at **0:40**
(18'), Vargas wins it at **3:00** (81'). **Restart match** replays it from kick-off. Other
seeds: `bun scripts/find-demo-seed.ts` in `web/`.

### Recording checklist

1. Record in the morning, on a fresh Groq quota. Gemini covers the rest if Groq runs out.
2. Start the three services (see the README), with the voice preloaded:
   `VOICE_PRELOAD="English,Swahili" uv run uvicorn sokait_voice.server:app --port 8001`
3. Microsoft Edge, headphones, 1920×1080, zoom 100%, other tabs and notifications off.
4. On the matchday page: favourite club Thames Rovers, and also follow one other club.
5. On the watch page: voice on (timeline speaker), language EN, viewing as Casual fan.
6. Rehearse once. Each Restart match calls the agents afresh (new moment ids), so keep
   retakes to the shots that need them to save quota.
7. Record each shot as its own take; cut them together in Clipchamp or any editor.
8. Export at 1080p, check it is under 2:00, upload to YouTube (unlisted is fine), and put
   the link in `README.md` and `docs/SUBMISSION.md`.
