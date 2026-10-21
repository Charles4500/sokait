import { useState } from "react";
import { MagicStar } from "iconsax-reactjs";
import { VerifiedBadge } from "./agent-trace";
import type { MatchEvent, Player, TeamId } from "@/match/engine";
import { favSide, useFixture } from "@/match/fixture-context";
import type { MatchStatus } from "@/match/hub";
import { ClubBadge, PlayerAvatar } from "./avatars";
import { PlayerPortrait } from "./player-card";
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
  corner,
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
  /** Bottom-right corner of the pitch, e.g. the Live now playlist. */
  corner?: React.ReactNode;
}) {
  const [view, setView] = useState<PitchView>("live");
  const info = useFixture();
  const { teams } = info;
  const mine = favSide(info, prefs.favClub);
  const [heatTeam, setHeatTeam] = useState<TeamId>(mine ?? "home");

  return (
    <section className="flex w-full bg-[radial-gradient(ellipse_at_center,oklch(0.32_0.07_150),oklch(0.2_0.04_160))] sm:aspect-video sm:max-h-[70vh] flex-col overflow-hidden rounded-2xl in-[:fullscreen]:flex-1 sm:in-[:fullscreen]:aspect-auto sm:in-[:fullscreen]:max-h-none">
      <div className="relative aspect-[111/80] min-h-0 sm:aspect-auto sm:flex-1">
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
          <div className="flex shrink-0 items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 py-2 font-display backdrop-blur-md">
            <ClubBadge team="home" size={26} /> {mine === "home" && "♥ "}
            {teams.home.short}{" "}
            <span className="text-xl">
              {score.home} - {score.away}
            </span>{" "}
            {teams.away.short}
            {mine === "away" && " ♥"} <ClubBadge team="away" size={26} />
            <span className="ml-2 rounded-md bg-win/20 px-2 text-xs text-win">
              {status === "finished" ? "FT" : `${minute}'`}
            </span>
          </div>
          {tag && (
            <div
              key={tag.id}
              className="min-w-0 truncate rounded-full border border-white/15 bg-primary/55 flex items-center gap-2 py-1 pl-1 pr-4 font-display text-sm text-primary-foreground backdrop-blur-md animate-slide-in"
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
              <PlayerPortrait player={fav} size={40} />
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
        {corner && <div className="absolute bottom-3 right-3 z-10 hidden md:block">{corner}</div>}
      </div>

      {/* Lower third: the on-air insight as a live comment, under the pitch on the same
          grass, so it never covers the play. */}
      <div className="flex shrink-0 flex-col items-stretch gap-1.5 px-3 pb-2 sm:flex-row sm:items-end sm:gap-4 sm:px-4">
        <LiveComment onAir={onAir} lang={prefs.lang} />
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

/** One insight at a time, in a fixed-height slot so the page never shifts. */
function LiveComment({ onAir, lang }: { onAir: OnAir | null; lang: string }) {
  return (
    <div aria-live="polite" className="flex h-12 min-w-0 flex-1 items-center">
      {onAir ? (
        <div
          key={onAir.title}
          className="flex max-w-full items-center gap-2 rounded-xl bg-black/30 py-1 pl-1 pr-3 animate-slide-in"
        >
          <span
            className={`shrink-0 rounded-full ring-2 ${onAir.team === "home" ? "ring-team-home" : "ring-team-away"}`}
          >
            <PlayerAvatar player={onAir.player} size={28} />
          </span>
          <p className="line-clamp-2 min-w-0 text-sm leading-snug text-white [text-shadow:0_1px_2px_oklch(0_0_0/0.6)]">
            <span className="mr-1.5 font-display font-semibold">
              {onAir.minute}' {onAir.player.name}
            </span>
            {onAir.text}
            <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] text-white/75">
              <MagicStar variant="Bulk" className="h-3 w-3 text-primary" />
              {onAir.ai ? `AI · ${lang}` : "Live"}
              {onAir.verification && <VerifiedBadge v={onAir.verification} />}
            </span>
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-[11px] text-white/70">
          <span className="h-1.5 w-1.5 rounded-full bg-live animate-live" />
          Live analysis · waiting for the next big moment
        </p>
      )}
    </div>
  );
}
