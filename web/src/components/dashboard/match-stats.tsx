import { Activity, Gps, Speedometer, TrendUp } from "iconsax-reactjs";
import { TEAMS, type Player } from "@/match/engine";
import { PlayerCard } from "./player-card";
import type { MatchStats as Stats, PlayerStats } from "./types";

/** MVP and headline numbers, computed by the match engine (not AI). */
export function MatchStats({
  stats,
  star,
  starStats,
}: {
  stats: Stats;
  star: { player: Player; score: number };
  starStats: PlayerStats;
}) {
  const tiles = [
    {
      t: "Shots",
      I: Gps,
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
      I: TrendUp,
      v: `${stats.control}%`,
      u: "control",
      s: `${stats.chaos}% turnover rate`,
      hl: true,
    },
    {
      t: "Top Shot Speed",
      I: Speedometer,
      v: `${stats.topShotSpeed}`,
      u: "km/h",
      s: `${stats.pressure.home + stats.pressure.away} press events`,
      hl: true,
    },
  ];

  return (
    <section className="rounded-2xl glass-strong p-4">
      <div className="grid gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
        <PlayerCard player={star.player} stats={starStats} label="Player of the match" />
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
