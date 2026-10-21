// Finds seeds for the demo video: the followed club (Thames Rovers, home) scores early
// through their number 10, the match has 3-4 goals, and it isn't settled until late.
// Open the best one with /watch?seed=N.
//   bun scripts/find-demo-seed.ts [count]
import { MATCH_LENGTH_S, initialState, nextEvent } from "@/match/engine";

const TICK_S = 1.1; // the hub's default MATCH_TICK_MS
const count = Number(process.argv[2] ?? 5);
const found: { seed: number; goals: string[]; firstAt: number }[] = [];

for (let seed = 1; seed < 20_000 && found.length < count; seed++) {
  let s = initialState(seed);
  while (s.clock < MATCH_LENGTH_S) s = nextEvent(s);
  const goals = s.events.flatMap((e, i) => (e.type === "goal" ? [{ e, at: i * TICK_S }] : []));
  const [first, ...rest] = goals;
  if (!first || goals.length < 3 || goals.length > 4) continue;
  const byTen = first.e.player.id === "thr-10" || first.e.target?.id === "thr-10";
  if (first.e.team !== "home" || !byTen || first.at > 30) continue;
  if (!rest.some((g) => g.e.minute >= 75)) continue; // a late goal keeps it open
  const home = goals.filter((g) => g.e.team === "home").length;
  if (home <= goals.length - home) continue; // the followed club wins
  found.push({
    seed,
    firstAt: Math.round(first.at),
    goals: goals.map((g) => `${g.e.minute}' ${g.e.team} ${g.e.player.name} (${Math.round(g.at)}s)`),
  });
}

for (const f of found) console.log(`seed ${f.seed}: ${f.goals.join(" · ")}`);
