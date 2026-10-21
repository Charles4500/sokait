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
- [x] PitchPulse Listen: spatial audio, spoken commentary, voice Q&A, screen-reader mode
- [x] Voice service (Piper) for natural speech in six languages
- [x] CI, git hooks, tests for every service; offline fault-injection evaluation

## Left

- [x] Realistic player portraits (FLUX.1-schnell on Cloudflare Workers AI)
- [ ] Live evaluation run on a fresh daily quota → `docs/EVAL.md`
- [ ] Demo video under 2 minutes (script below), uploaded to YouTube
- [ ] Make the repo public; decide on the commit email
- [ ] Submission text: pitch, Microsoft technologies, problem solved

## Demo video (under 2:00)

| Time | Shot                                                                                        |
| ---- | ------------------------------------------------------------------------------------------- |
| 0:00 | Problem: live stats don't tell fans _why_; most fans can't read xG; blind fans are left out |
| 0:12 | Dashboard live: pitch, a goal, the lower-third commentary, the commentary feed              |
| 0:30 | Switch persona and language: same moment, Analyst vs Fan, Swahili                           |
| 0:45 | "How the last insight was made": agent trace, evidence, a Fact-Checker repair               |
| 1:00 | Timeline: jump back to a goal; Live now: switch to the match your club is in                |
| 1:15 | PitchPulse Listen with headphones: spatial audio, spoken commentary, a voice question       |
| 1:40 | Architecture in one frame: agents, Fact-Checker, failover, Microsoft Agent Framework        |
| 1:55 | Close                                                                                       |

Before recording: fresh model quota, close other tabs, `VOICE_PRELOAD` set to the
languages shown, Microsoft Edge for natural browser voices.
