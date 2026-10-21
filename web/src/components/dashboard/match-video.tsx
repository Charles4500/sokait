import { useEffect, useState } from "react";
import { MagicStar } from "iconsax-reactjs";
import { VerifiedBadge } from "./agent-trace";
import { TEAMS, type MatchEvent, type Player, type TeamId } from "@/match/engine";
import type { MatchStatus } from "@/match/hub";
import { ClubBadge, PlayerAvatar } from "./avatars";
import { PitchViewSwitch, TacticalPitch, type PitchView } from "./tactical-pitch";
import type { OnAir, PlayerStats, Prefs } from "./types";

/** The live tactical view: overlays at the top, and a broadcast "lower third" strip
 *  under the pitch so insights never cover the play. */
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
  tag: { id: number; text: string; player: Player } | null;
  onAir: OnAir | null;
}) {
  const [view, setView] = useState<PitchView>("live");
  const [heatTeam, setHeatTeam] = useState<TeamId>(prefs.favClub);

  return (
    <section className="flex aspect-video max-h-[70vh] w-full flex-col overflow-hidden rounded-2xl in-[:fullscreen]:aspect-auto in-[:fullscreen]:max-h-none in-[:fullscreen]:flex-1">
      <div className="relative min-h-0 flex-1">
        <TacticalPitch
          events={events}
          favPlayer={prefs.favPlayer}
          playerFocus={prefs.mode === "player"}
          view={view}
          heatTeam={heatTeam}
        />

        {/* Top bar: scorebug, then the speed/distance tag beside it (never over the pitch) */}
        <div
          className={`absolute left-4 top-4 flex items-center gap-3 ${prefs.mode === "player" ? "right-60" : "right-4"}`}
        >
          <div className="flex shrink-0 items-center gap-3 rounded-full glass px-4 py-2 font-display">
            <ClubBadge team="home" size={26} /> {prefs.favClub === "home" && "♥ "}
            {TEAMS.home.short}{" "}
            <span className="text-xl">
              {score.home} - {score.away}
            </span>{" "}
            {TEAMS.away.short}
            {prefs.favClub === "away" && " ♥"} <ClubBadge team="away" size={26} />
            <span className="ml-2 rounded-md bg-win/20 px-2 text-xs text-win">
              {status === "finished" ? "FT" : `${minute}'`}
            </span>
          </div>
          {tag && (
            <div
              key={tag.id}
              className="min-w-0 truncate rounded-full bg-primary flex items-center gap-2 py-1 pl-1 pr-4 font-display text-sm text-primary-foreground shadow-cta animate-slide-in"
            >
              <PlayerAvatar player={tag.player} size={24} />
              {tag.text}
            </div>
          )}
        </div>

        {/* Player focus card */}
        {prefs.mode === "player" && (
          <div className="absolute right-4 top-4 w-52 rounded-xl glass p-3 text-xs animate-slide-in">
            <div className="flex items-center gap-2 font-display text-sm">
              <PlayerAvatar player={fav} size={28} />
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
      </div>

      {/* Lower third: the on-air insight, docked under the pitch */}
      <div className="flex min-h-19 shrink-0 items-center gap-4 border-t border-white/10 bg-background/85 px-4 py-2.5 backdrop-blur">
        <LowerThird onAir={onAir} lang={prefs.lang} />
        <PitchViewSwitch
          view={view}
          setView={setView}
          heatTeam={heatTeam}
          setHeatTeam={setHeatTeam}
        />
      </div>
    </section>
  );
}

function LowerThird({ onAir, lang }: { onAir: OnAir | null; lang: string }) {
  // After its broadcast time, the insight dims so the eye returns to the pitch.
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    if (!onAir) return;
    setFresh(true);
    const t = setTimeout(() => setFresh(false), onAir.durationMs);
    return () => clearTimeout(t);
  }, [onAir?.title, onAir?.durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!onAir) {
    return (
      <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-live animate-live" />
        Live analysis · waiting for the next big moment
      </p>
    );
  }
  return (
    <div
      key={onAir.title}
      className={`flex min-w-0 flex-1 items-center gap-3 transition-opacity duration-700 animate-slide-in ${fresh ? "opacity-100" : "opacity-55"}`}
    >
      <span
        aria-hidden
        className={`w-1 self-stretch rounded-full ${onAir.team === "home" ? "bg-team-home" : "bg-team-away"}`}
      />
      <PlayerAvatar player={onAir.player} size={34} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-foreground px-1.5 font-display text-xs font-semibold text-background">
            {onAir.minute}'
          </span>
          <span className="truncate font-display text-sm">{onAir.label}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <MagicStar variant="Bulk" className="h-3.5 w-3.5 text-primary" />
            {onAir.ai ? `AI · ${lang}` : "Live"}
            {onAir.verification && <VerifiedBadge v={onAir.verification} />}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
          {onAir.text}
        </p>
      </div>
    </div>
  );
}
