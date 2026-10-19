import { Activity, Gauge, Goal, TrendingUp } from "lucide-react";
import { TEAMS, type Player } from "@/match/engine";
import type { MatchStats as Stats } from "./types";

/** MVP and headline numbers, computed by the match engine (not AI). */
export function MatchStats({
  stats,
  star,
}: {
  stats: Stats;
  star: { player: Player; score: number };
}) {
  const tiles = [
    {
      t: "Shots",
      I: Goal,
      v: `${stats.shots.home + stats.shots.away}`,
      u: "Shots",
      s: `xG ${stats.xg.home} – ${stats.xg.away}`,
    },
    {
      t: "Passes",
      I: Activity,
      v: `${stats.passes.home + stats.passes.away}`,
      u: "Passes",
      s: `Avg difficulty ${stats.avgPassDifficulty}`,
    },
    {
      t: "Control vs Chaos",
      I: TrendingUp,
      v: `${stats.control}%`,
      u: "control",
      s: `${stats.chaos}% turnover rate`,
      hl: true,
    },
    {
      t: "Top Shot Speed",
      I: Gauge,
      v: `${stats.topShotSpeed}`,
      u: "km/h",
      s: `${stats.pressure.home + stats.pressure.away} press events`,
      hl: true,
    },
  ];

  return (
    <section className="rounded-2xl glass-strong p-4">
      <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="relative min-h-32 overflow-hidden rounded-xl bg-muted/50 p-3">
          <div className="text-xs">MVP of the match</div>
          <div className="mt-5 font-display text-base">{star.player.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {TEAMS[star.player.team].name} · #{star.player.num} {star.player.pos}
          </div>
          <div
            aria-hidden
            className={`absolute right-3 top-3 grid h-14 w-14 place-items-center rounded-full font-display text-2xl font-bold ring-2 ring-foreground/80 ${star.player.team === "home" ? "bg-team-home" : "bg-team-away"}`}
          >
            {star.player.num}
          </div>
          <div className="absolute bottom-3 right-3 rounded-lg bg-secondary px-2 py-1 text-center text-[10px] text-muted-foreground">
            Score<div className="font-display text-base text-foreground">{star.score}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
          {tiles.map(({ t, I, v, u, s, hl }) => (
            <div key={t} className="bg-glass-strong p-3">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                {t}
                <I className="h-3.5 w-3.5" />
              </div>
              <div className="mt-4 font-display text-lg">
                {v} <span className="text-xs text-muted-foreground">{u}</span>
              </div>
              <div className={`text-[11px] ${hl ? "text-win" : "text-muted-foreground"}`}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
