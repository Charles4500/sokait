import { TEAMS } from "@/match/engine";
import { ClubBadge } from "./avatars";
import type { MatchStats } from "./types";

export function WinProbability({ winProb }: { winProb: MatchStats["winProb"] }) {
  return (
    <section className="rounded-2xl glass-strong p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Win probability</h2>
        <span className="text-[11px] text-muted-foreground">Draw {winProb.draw}%</span>
      </div>
      {(["home", "away"] as const).map((t) => (
        <div key={t} className="mt-2 flex items-center gap-3 text-xs">
          <ClubBadge team={t} size={24} />
          <span className="w-28 truncate">{TEAMS[t].name}</span>
          <div className="h-1 flex-1 rounded-full bg-border">
            <div
              className="h-1 rounded-full bg-win transition-all"
              style={{ width: `${winProb[t]}%` }}
            />
          </div>
          <span className="w-8 text-right">{winProb[t]}%</span>
        </div>
      ))}
    </section>
  );
}
