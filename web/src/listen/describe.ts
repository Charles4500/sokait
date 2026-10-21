// Words for where and what, for listeners who cannot see the pitch. Pure functions:
// the same event always produces the same words, so they are testable and cost no AI.
import {
  PITCH,
  TEAMS,
  computeStats,
  depth,
  playerStats,
  PLAYERS,
  type MatchEvent,
  type Player,
  type TeamId,
  type Teams,
} from "@/match/engine";

/** Where the ball is, from the point of view of the team on the ball. */
export function where(team: TeamId, x: number, y: number): string {
  const d = depth(team, x);
  const area =
    d < 16.5
      ? "in their own box"
      : d < 35
        ? "deep in their own half"
        : d < 52.5
          ? "in their own half"
          : d < 70
            ? "in midfield"
            : d < 88.5
              ? "in the attacking third"
              : "in the box";
  // Facing the opponent's goal, the home side's left is the top touchline (small y).
  const leftFirst = team === "home" ? y : PITCH.width - y;
  const side = leftFirst < 22.7 ? "left side" : leftFirst > 45.3 ? "right side" : "centrally";
  return `${area}, ${side}`;
}

const surname = (name: string) => name.split(" ").slice(-1)[0]!;

/** A few spoken words for one event, for the "every touch" detail level. */
export function shortLine(e: MatchEvent, teams: Teams = TEAMS): string {
  const p = surname(e.player.name);
  switch (e.type) {
    case "pass":
      return e.passAccurate && e.target ? `${p} to ${surname(e.target.name)}` : `${p}, loose pass`;
    case "shot":
      return `${p} shoots`;
    case "goal":
      return `Goal! ${e.player.name}`;
    case "save":
      return `Saved by ${p}`;
    case "tackle":
      return `${p} wins it`;
    case "pressure":
      return `${p} presses`;
    case "possession":
      return `${teams[e.team].name} on the ball`;
  }
}

// Real commentators' calls, picked by event id: varied, but the same moment always
// sounds the same (replays, tests).
const GOAL_CALLS = [
  (n: string) => `GOAL! What a finish from ${n}!`,
  (n: string) => `He's done it! ${n} scores!`,
  (n: string) => `It's in! ${n}!`,
  (n: string) => `GOAL! ${n}, and the place erupts!`,
  (n: string) => `What a goal from ${n}!`,
];
const CHANCE_CALLS = [
  (n: string) => `Oh, so close from ${n}!`,
  (n: string) => `${n} shoots, and that was inches away!`,
  (n: string) => `Big chance for ${n}!`,
  (n: string) => `How has that stayed out? ${n}!`,
];
const SHOT_CALLS = [
  (n: string) => `${n} has a go`,
  (n: string) => `${n} tries his luck`,
  (n: string) => `Shot from ${n}`,
];
const PASS_CALLS = [
  (n: string) => `Lovely ball from ${n}`,
  (n: string) => `What vision from ${n}`,
  (n: string) => `${n} splits them open`,
];
const pick = <T>(bank: T[], id: number) => bank[id % bank.length]!;

/** The line spoken first for a key moment, before AI narration arrives. */
export function keyMomentLine(
  e: MatchEvent,
  score: Record<TeamId, number>,
  teams: Teams = TEAMS,
): string {
  const at = where(e.team, e.x, e.y);
  const name = surname(e.player.name);
  if (e.type === "goal") {
    return `${pick(GOAL_CALLS, e.id)(name)} ${teams[e.team].name}, ${at}. It's ${scoreLine(score, teams)}.`;
  }
  if (e.type === "shot") {
    const call = (e.xg ?? 0) >= 0.3 ? pick(CHANCE_CALLS, e.id) : pick(SHOT_CALLS, e.id);
    return `${call(name)}, ${at}.`;
  }
  if (e.type === "pass" && e.passAccurate) return `${pick(PASS_CALLS, e.id)(name)}, ${at}.`;
  return `${e.player.name}, ${at}.`;
}

export function scoreLine(score: Record<TeamId, number>, teams: Teams = TEAMS): string {
  return `${teams.home.name} ${score.home}, ${teams.away.name} ${score.away}`;
}

export interface MatchContext {
  events: MatchEvent[];
  score: Record<TeamId, number>;
  minute: number;
  favPlayer: string;
  teams?: Teams;
  players?: Player[];
}

/**
 * Answers the common spoken questions on the device: instant, offline, no tokens.
 * Returns null when the agent should answer instead.
 */
export function localAnswer(question: string, ctx: MatchContext): string | null {
  const q = question.toLowerCase();
  const teams = ctx.teams ?? TEAMS;
  const players = ctx.players ?? PLAYERS;
  const last = ctx.events[ctx.events.length - 1];
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("score", "winning", "who's ahead", "who is ahead")) {
    return `It's ${scoreLine(ctx.score, teams)}, in minute ${ctx.minute}.`;
  }
  if (has("time", "minute", "how long")) {
    return `It's minute ${ctx.minute}. ${scoreLine(ctx.score, teams)}.`;
  }
  if (has("where is the ball", "where's the ball", "where the ball")) {
    if (!last) return "The match hasn't started yet.";
    return `${teams[last.team].name} have it ${where(last.team, last.toX, last.toY)}.`;
  }
  if (has("who has the ball", "who's got the ball", "who has it", "possession")) {
    if (!last) return "The match hasn't started yet.";
    const stats = computeStats(ctx.events);
    return `${last.player.name} of ${teams[last.team].name}. Possession is ${teams.home.name} ${stats.possession.home} percent, ${teams.away.name} ${stats.possession.away} percent.`;
  }
  const named = players.find(
    (p) => q.includes(p.name.toLowerCase()) || q.includes(surname(p.name).toLowerCase()),
  );
  const asksAboutMine = has("my player", "how is he", "how's he");
  const player = named ?? (asksAboutMine ? players.find((p) => p.id === ctx.favPlayer) : undefined);
  if (player && has("how", "doing", "playing", "stats")) {
    const s = playerStats(ctx.events, player.id);
    return `${player.name} has ${s.touches} touches, ${s.passAcc} percent passing, ${s.goals} goals and a rating of ${s.rating}.`;
  }
  return null;
}
