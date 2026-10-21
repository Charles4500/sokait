import { RowVertical } from "iconsax-reactjs";
import { useFixture } from "@/match/fixture-context";
import type { Dual, MatchStats } from "./types";

/** Same moment narrated for an analyst and a casual fan, side by side. */
export function ComparePanel({ dual, stats }: { dual: Dual | null; stats: MatchStats }) {
  const { teams } = useFixture();
  return (
    <section className="rounded-2xl glass-strong p-4 animate-slide-in">
      <div className="flex items-center gap-2 text-sm">
        <RowVertical className="h-4 w-4" />
        Same moment, two fans{" "}
        <span className="text-muted-foreground">
          · {dual?.title ?? "waiting for next key moment…"}
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="text-[10px] uppercase tracking-wider text-primary">Analyst</div>
          <p className="mt-1 text-sm">{dual?.analyst ?? "—"}</p>
          <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
            <span>
              xG {stats.xg.home}–{stats.xg.away}
            </span>
            <span>Ctrl {stats.control}%</span>
            <span>
              Press {stats.pressure.home}/{stats.pressure.away}
            </span>
            <span>Pass diff {stats.avgPassDifficulty}</span>
          </div>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="text-[10px] uppercase tracking-wider text-win">Casual fan</div>
          <p className="mt-1 text-base">{dual?.casual ?? "—"}</p>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {teams.home.short} {stats.winProb.home}% to win ·{" "}
            {stats.momentum > 2
              ? "🔥 on top"
              : stats.momentum < -2
                ? "under pressure"
                : "evenly matched"}
          </div>
        </div>
      </div>
    </section>
  );
}
