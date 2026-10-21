// Game-style player art: a face in the club's kit, and an EA FC-style card whose
// ratings come from what the player has actually done in this (synthetic) match.
import { useState } from "react";
import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import type { Player, TeamId } from "@/match/engine";
import { useFixture } from "@/match/fixture-context";
import { ClubBadge } from "./avatars";
import { photoOf } from "./player-art";
import type { PlayerStats } from "./types";

const KIT: Record<TeamId, { shirt: string; trim: string }> = {
  home: { shirt: "#e5484d", trim: "#8f1d22" },
  away: { shirt: "#2f8fdf", trim: "#0f4c81" },
};

const faces = new Map<string, string>();
function face(player: Player): string {
  let uri = faces.get(player.id);
  if (!uri) {
    uri = createAvatar(notionists, {
      seed: player.id,
      gestureProbability: 0,
      bodyIconProbability: 0,
      glassesProbability: 0,
    }).toDataUri();
    faces.set(player.id, uri);
  }
  return uri;
}

/** The player's generated portrait with his shirt number in kit colour; the illustrated
 *  version stands in when a portrait is missing. */
export function PlayerPortrait({ player, size = 96 }: { player: Player; size?: number }) {
  const [photo, setPhoto] = useState(true);
  if (!photo) return <DrawnPortrait player={player} size={size} />;
  const fade = "linear-gradient(to bottom, black 72%, transparent)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size * 1.05 }}>
      <img
        src={photoOf(player)}
        onError={() => setPhoto(false)}
        alt=""
        aria-hidden
        className="h-full w-full rounded-xl object-cover object-top"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      />
      <span
        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-md px-1.5 font-display text-xs font-extrabold text-white shadow-md"
        style={{ background: KIT[player.team].shirt }}
      >
        {player.num}
      </span>
    </div>
  );
}

/** Illustrated head and shoulders in the club's kit, with the shirt number. */
function DrawnPortrait({ player, size }: { player: Player; size: number }) {
  const kit = KIT[player.team];
  return (
    <svg
      viewBox="0 0 100 110"
      width={size}
      height={(size * 110) / 100}
      aria-hidden
      className="shrink-0 drop-shadow-[0_6px_12px_rgb(0_0_0/0.35)]"
    >
      <image href={face(player)} x="2" y="-12" width="96" height="96" />
      {/* Shirt over the shoulders */}
      <path
        d="M4,110 L4,96 Q6,81 27,77 L39,73 Q50,83 61,73 L73,77 Q94,81 96,96 L96,110 Z"
        fill={kit.shirt}
      />
      <path d="M39,73 Q50,83 61,73 L58,72 Q50,79 42,72 Z" fill={kit.trim} />
      <path d="M4,96 Q6,81 27,77 L23,95 Z" fill={kit.trim} opacity="0.55" />
      <path d="M96,96 Q94,81 73,77 L77,95 Z" fill={kit.trim} opacity="0.55" />
      <text
        x="50"
        y="104"
        textAnchor="middle"
        fontSize="15"
        fontWeight="800"
        fill="white"
        style={{ fontFamily: "var(--font-display, sans-serif)" }}
      >
        {player.num}
      </text>
    </svg>
  );
}

const clamp = (v: number) => Math.max(35, Math.min(99, Math.round(v)));

/** Card ratings from this match's events (synthetic: they only describe today). */
function cardRatings(s: PlayerStats) {
  return {
    overall: clamp(s.rating * 10),
    stats: [
      ["PAC", clamp(40 + (s.topSpeed - 14) * 2.6)],
      ["SHO", clamp(45 + s.shots * 6 + s.goals * 12)],
      ["PAS", s.passes ? clamp(s.passAcc) : 50],
      ["DRI", clamp(45 + s.touches * 1.4)],
      ["DEF", clamp(40 + s.tackles * 8)],
      ["PHY", clamp(45 + s.distance * 6)],
    ] as const,
  };
}

/** EA FC-style card. `gold` for the MVP; `club` tints it in the player's colours. */
export function PlayerCard({
  player,
  stats,
  tone = "gold",
  label,
}: {
  player: Player;
  stats: PlayerStats;
  tone?: "gold" | "club";
  label?: string;
}) {
  const { overall, stats: rows } = cardRatings(stats);
  const { teams } = useFixture();
  const surface =
    tone === "gold"
      ? "bg-[linear-gradient(150deg,#f7e59a_0%,#d9b443_45%,#8c6a12_100%)] text-[#2a1f00]"
      : player.team === "home"
        ? "bg-[linear-gradient(150deg,#ff8a8d_0%,#c4363b_55%,#5e1013_100%)] text-white"
        : "bg-[linear-gradient(150deg,#8cc8ff_0%,#2f7fd0_55%,#0b3560_100%)] text-white";
  return (
    <div
      className={`relative flex h-full min-h-36 items-stretch gap-2 overflow-hidden rounded-xl p-3 shadow-lg ${surface}`}
    >
      {/* Sheen like a printed card */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
      <div className="relative flex flex-col items-center justify-start gap-0.5 pr-1">
        <span className="font-display text-3xl font-extrabold leading-none">{overall}</span>
        <span className="font-display text-xs font-bold tracking-wide">{player.pos}</span>
        <div className="mt-1">
          <ClubBadge team={player.team} size={22} />
        </div>
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col items-center">
        {label && (
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
            {label}
          </span>
        )}
        <PlayerPortrait player={player} size={78} />
        <span className="mt-1 max-w-full truncate font-display text-sm font-bold">
          {player.name.split(" ").slice(-1)[0]}
        </span>
        <span className="text-[10px] opacity-75">
          {teams[player.team].short} · #{player.num}
        </span>
      </div>
      <dl className="relative grid shrink-0 grid-cols-2 content-center gap-x-2.5 gap-y-1 text-[11px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-1">
            <dd className="font-display text-sm font-bold">{v}</dd>
            <dt className="font-semibold opacity-75">{k}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
