import { Flash, MagicStar } from "iconsax-reactjs";
import { VerifiedBadge } from "./agent-trace";
import { TEAMS, type MatchEvent, type Player, type TeamId } from "@/match/engine";
import type { MatchStatus } from "@/match/hub";
import { Crest } from "./crest";
import { TacticalPitch } from "./tactical-pitch";
import type { OnAir, PlayerStats, Prefs } from "./types";

/** The live tactical view with everything a broadcast would overlay on it. */
export function MatchVideo({
  events,
  score,
  minute,
  status,
  prefs,
  fav,
  favStats,
  tag,
  onAir,
}: {
  events: MatchEvent[];
  score: Record<TeamId, number>;
  minute: number;
  status: MatchStatus;
  prefs: Prefs;
  fav: Player;
  favStats: PlayerStats;
  tag: { id: number; text: string } | null;
  onAir: OnAir | null;
}) {
  return (
    <section className="relative aspect-video max-h-[70vh] w-full overflow-hidden rounded-2xl [:fullscreen_&]:aspect-auto [:fullscreen_&]:max-h-none [:fullscreen_&]:flex-1">
      <TacticalPitch
        events={events}
        favPlayer={prefs.favPlayer}
        playerFocus={prefs.mode === "player"}
        favClub={prefs.favClub}
      />

      {/* Scorebug */}
      <div className="absolute left-4 top-4 flex items-center gap-3 rounded-full glass px-4 py-2 font-display">
        <Crest team="home" size={26} /> {prefs.favClub === "home" && "♥ "}
        {TEAMS.home.short}{" "}
        <span className="text-xl">
          {score.home} - {score.away}
        </span>{" "}
        {TEAMS.away.short}
        {prefs.favClub === "away" && " ♥"} <Crest team="away" size={26} />
        <span className="ml-2 rounded-md bg-win/20 px-2 text-xs text-win">
          {status === "finished" ? "FT" : `${minute}'`}
        </span>
      </div>

      {/* Threshold-triggered player tag (speed / distance) */}
      {tag && (
        <div
          key={tag.id}
          className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 font-display text-sm text-primary-foreground shadow-cta animate-slide-in"
        >
          <Flash className="mr-1 inline h-3.5 w-3.5" />
          {tag.text}
        </div>
      )}

      {/* Player focus card */}
      {prefs.mode === "player" && (
        <div className="absolute right-4 top-4 w-52 rounded-xl glass p-3 text-xs animate-slide-in">
          <div className="flex items-center gap-2 font-display text-sm">
            <Flash className="h-3.5 w-3.5 text-primary" />
            {fav.name}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["Touches", favStats.touches],
                ["Pass %", favStats.passAcc],
                ["Rating", favStats.rating],
                ["Dist km", favStats.distance],
                ["Top km/h", favStats.topSpeed],
                ["Goals", favStats.goals],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <div className="font-display text-sm">{v}</div>
                <div className="text-[9px] text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* On-air insight */}
      {onAir && (
        <div
          key={onAir.title}
          className="absolute bottom-3 left-3 right-48 max-w-xl rounded-xl glass p-3 animate-slide-in"
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MagicStar variant="Bulk" className="h-3.5 w-3.5 text-primary" />
            {onAir.ai ? `AI insight · ${prefs.lang}` : "Live insight"}
            {onAir.verification && (
              <>
                <span>·</span>
                <VerifiedBadge v={onAir.verification} />
              </>
            )}
          </div>
          <div className="mt-1 font-display text-base">{onAir.title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{onAir.text}</p>
        </div>
      )}
    </section>
  );
}
