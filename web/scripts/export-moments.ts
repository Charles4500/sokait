// Exports the key moments of a seeded match as the exact requests the dashboard sends
// to the agent service, for the evaluation in agents/eval.
//   bun scripts/export-moments.ts [seed] [out.json]
import { writeFileSync } from "node:fs";
import {
  TEAMS,
  computeStats,
  explain,
  initialState,
  nextEvent,
  MATCH_LENGTH_S,
} from "@/match/engine";
import { where } from "@/listen/describe";

const seed = Number(process.argv[2] ?? 7);
const out = process.argv[3] ?? "../agents/eval/moments.json";

let s = initialState(seed);
while (s.clock < MATCH_LENGTH_S) s = nextEvent(s);

const score = { home: 0, away: 0 };
const moments = s.events.flatMap((e, i) => {
  if (e.type === "goal") score[e.team]++;
  if (e.importance < 0.6) return [];
  const stats = computeStats(s.events.slice(0, i + 1));
  return [
    {
      match_id: `eval-${seed}`,
      moment_id: `1:${e.id}`,
      minute: e.minute,
      event: {
        ...e,
        player: e.player.name,
        target: e.target?.name,
        where: where(e.team, e.x, e.y),
      },
      score: { ...score },
      stats,
      teams: { home: TEAMS.home, away: TEAMS.away },
      segments: [],
      fallback_text: explain(e, stats),
    },
  ];
});

writeFileSync(out, JSON.stringify(moments, null, 1));
console.log(`seed ${seed}: ${moments.length} key moments of ${s.events.length} events -> ${out}`);
