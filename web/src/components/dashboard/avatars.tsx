// Generated artwork for synthetic clubs and players (DiceBear, CC0 styles): unique,
// consistent for the same seed, made locally with no network call.
import { useState } from "react";
import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import * as shapes from "@dicebear/shapes";
import type { Player, TeamId } from "@/match/engine";
import { photoOf } from "./player-art";
import { useFixture } from "@/match/fixture-context";

// Close to the --team-home / --team-away theme colours.
const TEAM_HEX: Record<TeamId, string> = { home: "e5484d", away: "2f8fdf" };
// Club palette for the badge's shapes: a darker shade, white, and a light tint.
const TEAM_SHAPES: Record<TeamId, string[]> = {
  home: ["8f1d22", "ffffff", "f7b2b4"],
  away: ["0f4c81", "ffffff", "a9d2f5"],
};
const RING: Record<TeamId, string> = { home: "ring-team-home", away: "ring-team-away" };

const cache = new Map<string, string>();
function dataUri(key: string, make: () => string): string {
  let uri = cache.get(key);
  if (!uri) {
    uri = make();
    cache.set(key, uri);
  }
  return uri;
}

/** A club badge: shapes unique to the club, in its side's colours for this match.
 *  `clubId` overrides the club (e.g. for other fixtures in the Live now list). */
export function ClubBadge({
  team,
  clubId,
  size = 28,
}: {
  team: TeamId;
  clubId?: string;
  size?: number;
}) {
  const { teams } = useFixture();
  const club = clubId ?? teams[team].id;
  const src = dataUri(`club:${club}:${team}`, () =>
    createAvatar(shapes, {
      seed: club,
      backgroundColor: [TEAM_HEX[team]],
      shape1Color: [TEAM_SHAPES[team][0]!],
      shape2Color: [TEAM_SHAPES[team][1]!],
      shape3Color: [TEAM_SHAPES[team][2]!],
      radius: 50,
    }).toDataUri(),
  );
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0 rounded-full ring-2 ring-foreground/80"
      style={{ width: size, height: size }}
    />
  );
}

/** Illustrated fallback when a player has no generated portrait. */
function drawnFace(player: Player): string {
  return dataUri(`player:${player.id}`, () =>
    createAvatar(notionists, {
      seed: player.id,
      backgroundColor: ["f1f1f4"],
      radius: 50,
    }).toDataUri(),
  );
}

/** A player's face, ringed in his club's colour. */
export function PlayerAvatar({
  player,
  size = 28,
  className = "",
}: {
  player: Player;
  size?: number;
  className?: string;
}) {
  const [photo, setPhoto] = useState(true);
  return (
    <img
      src={photo ? photoOf(player) : drawnFace(player)}
      onError={() => setPhoto(false)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 rounded-full object-cover ring-2 ${RING[player.team]} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
