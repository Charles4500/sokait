// Where to draw each player for a given event. Purely visual and deterministic:
// a base formation per team, shifted as a block toward the ball, with the event's
// actor on the ball and a pass target at the ball's destination.
import { PITCH, PLAYERS, depth, type MatchEvent, type Player, type TeamId } from "@/match/engine";

export interface Dot {
  x: number;
  y: number;
}

/** Formation slots in squad order (GK first), in team-relative depth (metres from
 *  own goal line) and absolute y. Any club's squad fills the same shape. */
const FORMATION: Record<TeamId, Dot[]> = {
  home: [
    { x: 4, y: 34 },
    { x: 22, y: 24 },
    { x: 22, y: 44 },
    { x: 40, y: 34 },
    { x: 58, y: 28 },
    { x: 62, y: 56 },
    { x: 74, y: 36 },
  ],
  away: [
    { x: 4, y: 34 },
    { x: 22, y: 34 },
    { x: 34, y: 42 },
    { x: 44, y: 24 },
    { x: 62, y: 56 },
    { x: 74, y: 30 },
    { x: 58, y: 38 },
  ],
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const absX = (team: TeamId, a: number) => (team === "home" ? a : PITCH.length - a);

export function playerPositions(
  e: MatchEvent | undefined,
  players: Player[] = PLAYERS,
): Map<string, Dot> {
  const ball = e ? { x: e.x, y: e.y } : { x: PITCH.length / 2, y: PITCH.width / 2 };
  const out = new Map<string, Dot>();
  const slot = { home: 0, away: 0 };
  for (const p of players) {
    const base = FORMATION[p.team][slot[p.team]++] ?? { x: 40, y: 34 };
    const keeper = p.pos === "GK";
    // The whole side steps up when the ball is in its attacking half, and slides across.
    const push = (depth(p.team, ball.x) - PITCH.length / 2) * (keeper ? 0.12 : 0.45);
    const slide = (ball.y - PITCH.width / 2) * (keeper ? 0.1 : 0.3);
    out.set(p.id, {
      x: clamp(absX(p.team, base.x + push), 1, PITCH.length - 1),
      y: clamp(base.y + slide, 2, PITCH.width - 2),
    });
  }
  if (e) {
    out.set(e.player.id, { x: e.x, y: e.y });
    if (e.target) out.set(e.target.id, { x: e.toX, y: e.toY });
  }
  return out;
}
