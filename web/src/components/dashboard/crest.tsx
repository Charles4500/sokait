import { TEAMS, type TeamId } from "@/match/engine";

export function Crest({ team, size = 44 }: { team: TeamId | string; size?: number }) {
  const t = team === "home" || team === "away" ? TEAMS[team as TeamId] : null;
  const label = t ? t.short : String(team).slice(0, 2).toUpperCase();
  const cls = team === "home" ? "bg-team-home" : team === "away" ? "bg-team-away" : "bg-secondary";
  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(7, size / 4) }}
      className={`${cls} grid place-items-center rounded-full ring-2 ring-foreground/80 font-display font-bold text-foreground shrink-0`}
    >
      {label}
    </div>
  );
}
