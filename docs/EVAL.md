# Evaluation

Key moments exported from synthetic match seed 3 (`web/scripts/export-moments.ts`): 21 moments, 3 goals.

## Live run (openai-compatible, 21 key moments × 2 audiences)

Moments are paced to the per-minute token budget, as key moments would arrive in a live match; the wait is not counted as latency.

| Metric                                              | Result                          |
| --------------------------------------------------- | ------------------------------- |
| Analyst produced a grounded insight                 | 95%                             |
| Narration verified first time                       | 93%                             |
| Repaired by the Fact-Checker loop                   | 2%                              |
| Fell back to the deterministic explanation          | 5%                              |
| Numbers in aired AI text checked against match data | 82 (every one, by construction) |
| Latency per moment, p50 / p95                       | 1.94 s / 3.02 s                 |
| Tokens per moment (all agents, both audiences)      | 4,284                           |

Example narration:

- **GOAL! Theo Quinn (92 km/h)** (English): What a goal from Quinn! That early strike forces Thames Rovers to drop their possession game and brace for a counter‑attack battle.
- **GOAL! Theo Quinn (92 km/h)** (Swahili): Goli la dakika 6 kutoka Theo Quinn, ndani ya kisanduku katikati, mpira ulipiga kasi 92 km/h. Licha ya umiliki 67% wa ushikaji, Thames Rovers lazima ibadili mkakati hadi mashambulizi ya kukabiliana.
- **Theo Quinn shot · xG 0.37** (English): Oh, Quinn unleashes a thunderous shot! ⚡️ At 0.37 xG it could crack Thames Rovers' early grip and swing the momentum.
- **Theo Quinn shot · xG 0.37** (Swahili): Theo Quinn hupiga risasi ya nguvu katikati, katika kisanduku, dakika 14. Fursa hii yenye xG 0.37 inaweza kuvunja mkanda wa ulinzi wa Thames Rovers na kubadilisha kasi ya mchezo.

## Fault injection (offline)

The narrator is forced to invent statistics in its first draft for every moment on an even minute.

| Metric                                   | Result    |
| ---------------------------------------- | --------- |
| Drafts with invented numbers             | 28        |
| Caught by the Fact-Checker               | 28 (100%) |
| Invented numbers that reached the screen | 0         |
| Narrations repaired / fell back          | 28 / 0    |
