// Where to draw each player for a given event. Purely visual and deterministic:
// a base formation per team, shifted as a block toward the ball, with the event's
// actor on the ball and a pass target at the ball's destination.
import { PITCH, PLAYERS, depth, type MatchEvent, type TeamId } from "@/match/engine";

export interface Dot {
  x: number;
  y: number;
}

/** Formation in team-relative depth (metres from own goal line) and absolute y. */
const FORMATION: Record<string, Dot> = {
  "home-1": { x: 4, y: 34 },
  "home-4": { x: 22, y: 24 },
  "home-5": { x: 22, y: 44 },
  "home-8": { x: 40, y: 34 },
  "home-10": { x: 58, y: 28 },
  "home-7": { x: 62, y: 56 },
  "home-9": { x: 74, y: 36 },
  "away-1": { x: 4, y: 34 },
  "away-3": { x: 22, y: 34 },
  "away-6": { x: 34, y: 42 },
  "away-8": { x: 44, y: 24 },
  "away-14": { x: 58, y: 38 },
  "away-11": { x: 62, y: 56 },
  "away-9": { x: 74, y: 30 },
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const absX = (team: TeamId, a: number) => (team === "home" ? a : PITCH.length - a);

export function playerPositions(e: MatchEvent | undefined): Map<string, Dot> {
  const ball = e ? { x: e.x, y: e.y } : { x: PITCH.length / 2, y: PITCH.width / 2 };
  const out = new Map<string, Dot>();
  for (const p of PLAYERS) {
    const base = FORMATION[p.id] ?? { x: 40, y: 34 };
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
