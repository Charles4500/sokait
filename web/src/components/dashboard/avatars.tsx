// Generated artwork for synthetic clubs and players (DiceBear, CC0 styles): unique,
// consistent for the same seed, made locally with no network call.
import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import * as shapes from "@dicebear/shapes";
import { TEAMS, type Player, type TeamId } from "@/match/engine";

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

/** A club badge: abstract shapes in the club's colour. */
export function ClubBadge({ team, size = 28 }: { team: TeamId; size?: number }) {
  const src = dataUri(`club:${team}`, () =>
    createAvatar(shapes, {
      seed: TEAMS[team].name,
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
  const src = dataUri(`player:${player.id}`, () =>
    createAvatar(notionists, {
      seed: player.id,
      backgroundColor: ["f1f1f4"],
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
      className={`shrink-0 rounded-full ring-2 ${RING[player.team]} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
