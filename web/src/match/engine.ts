// Synthetic, football-realistic event generator + interpreter.
// No real league data: all clubs/players are fictional.

export type TeamId = "home" | "away";
export type EventType = "pass" | "shot" | "tackle" | "possession" | "pressure" | "goal" | "save";

export interface Player {
  id: string;
  name: string;
  num: number;
  pos: string;
  team: TeamId;
}
export interface MatchEvent {
  id: number;
  minute: number;
  second: number;
  type: EventType;
  team: TeamId;
  player: Player;
  target?: Player;
  passDistance?: number;
  passAccurate?: boolean;
  passDifficulty?: number;
  ballSpeed?: number;
  xg?: number;
  zone: "def" | "mid" | "att";
  importance: number; // 0..1
  runSpeed?: number; // km/h of the actor at event time
  label: string;
  /** Ball position in metres when the event happens (105×68 pitch, home attacks toward x=105). */
  x: number;
  y: number;
  /** Where the ball ends up: pass destination, shot end point, or recovery spot. */
  toX: number;
  toY: number;
}

export const TEAMS = {
  home: { name: "Thames Rovers", short: "THR", color: "var(--team-home)" },
  away: { name: "Mersey Athletic", short: "MER", color: "var(--team-away)" },
} as const;

const mk = (team: TeamId, list: [string, number, string][]): Player[] =>
  list.map(([name, num, pos]) => ({ id: `${team}-${num}`, name, num, pos, team }));

export const PLAYERS: Player[] = [
  ...mk("home", [
    ["Leo Marlowe", 1, "GK"],
    ["Ade Okafor", 4, "CB"],
    ["Tom Reyes", 5, "CB"],
    ["Kai Brennan", 8, "CM"],
    ["Nico Vargas", 10, "AM"],
    ["Sami Hale", 7, "RW"],
    ["Jonah Pike", 9, "ST"],
  ]),
  ...mk("away", [
    ["Ivo Kranz", 1, "GK"],
    ["Ollie Dunn", 3, "CB"],
    ["Rafa Sol", 6, "DM"],
    ["Max Ferro", 8, "CM"],
    ["Eli Mensah", 11, "LW"],
    ["Dario Lusk", 9, "ST"],
    ["Theo Quinn", 14, "AM"],
  ]),
];

// Seeded PRNG (mulberry32). Its state lives in MatchState so nextEvent stays pure:
// the same seed always replays the same match.
function makeRng(state: number) {
  let a = state >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    rand: (lo: number, hi: number) => lo + next() * (hi - lo),
    pick: <T>(arr: T[]) => arr[Math.floor(next() * arr.length)]!,
    state: () => a,
  };
}

const outfield = (t: TeamId) => PLAYERS.filter((p) => p.team === t && p.pos !== "GK");

// ---------- Pitch geometry ----------
export const PITCH = { length: 105, width: 68 } as const;
const CENTRE = { x: PITCH.length / 2, y: PITCH.width / 2 };
const r1 = (v: number) => Math.round(v * 10) / 10;
const clampX = (x: number) => Math.max(1, Math.min(PITCH.length - 1, x));
const clampY = (y: number) => Math.max(1, Math.min(PITCH.width - 1, y));
/** Distance from a team's own goal line → absolute x. */
const absX = (team: TeamId, a: number) => (team === "home" ? a : PITCH.length - a);
/** Absolute x → distance from that team's own goal line. */
export const depth = (team: TeamId, x: number) => (team === "home" ? x : PITCH.length - x);
const zoneOf = (team: TeamId, x: number): MatchEvent["zone"] => {
  const a = depth(team, x);
  return a < 35 ? "def" : a < 70 ? "mid" : "att";
};
const ZONE_DEPTH = { def: [10, 36], mid: [36, 70], att: [70, 96] } as const;

export interface MatchState {
  clock: number; // seconds
  possession: TeamId;
  score: Record<TeamId, number>;
  events: MatchEvent[];
  homeBias: number; // drifting momentum
  seed: number;
  rng: number; // PRNG state after the last event
  seq: number; // last event id
  ball: { x: number; y: number };
}

export const MATCH_LENGTH_S = 90 * 60;

export const initialState = (seed = 42): MatchState => ({
  clock: 0,
  possession: "home",
  score: { home: 0, away: 0 },
  events: [],
  homeBias: 0.52,
  seed,
  rng: seed >>> 0,
  seq: 0,
  ball: { ...CENTRE },
});

export function nextEvent(s: MatchState): MatchState {
  const { next, rand, pick, state: rngState } = makeRng(s.rng);
  const clock = s.clock + Math.round(rand(15, 45));
  const minute = Math.min(90, Math.floor(clock / 60));
  const homeBias = Math.max(0.3, Math.min(0.7, s.homeBias + rand(-0.04, 0.04)));
  let team = s.possession;
  const r = next();
  const opp = (t: TeamId): TeamId => (t === "home" ? "away" : "home");
  // Play drifts from where the ball is toward a sampled area of the actor's half,
  // so consecutive events read as continuous movement on the pitch.
  const startFor = (t: TeamId) => {
    const [lo, hi] = ZONE_DEPTH[pick<MatchEvent["zone"]>(["def", "mid", "mid", "att"])];
    const target = { x: absX(t, rand(lo, hi)), y: rand(6, PITCH.width - 6) };
    return {
      x: r1(clampX(s.ball.x + (target.x - s.ball.x) * 0.6)),
      y: r1(clampY(s.ball.y + (target.y - s.ball.y) * 0.6)),
    };
  };
  const near = (spread: number) => ({
    x: r1(clampX(s.ball.x + rand(-spread, spread))),
    y: r1(clampY(s.ball.y + rand(-spread, spread))),
  });
  const base = { id: s.seq + 1, minute, second: clock % 60 };
  let ev: MatchEvent;
  let possession = team;
  let ball = { ...s.ball };
  const score = { ...s.score };

  if (r < 0.5) {
    const p = pick(outfield(team));
    let t = pick(outfield(team));
    if (t.id === p.id) t = pick(outfield(team));
    const from = startFor(team);
    const zone = zoneOf(team, from.x);
    const passDistance = Math.round(rand(5, 48));
    const passDifficulty = Math.min(
      10,
      Math.round((passDistance / 5 + (zone === "att" ? 3 : 0) + rand(0, 2)) * 10) / 10,
    );
    const passAccurate = next() > passDifficulty / 14;
    if (!passAccurate) possession = opp(team);
    // Mostly forward, sometimes recycled backwards or square.
    const back = next() < 0.25;
    const angle = back ? Math.PI * rand(0.55, 1) * (next() < 0.5 ? -1 : 1) : rand(-1.1, 1.1);
    const dir = team === "home" ? 1 : -1;
    const miss = passAccurate ? 0 : 5;
    const toX = r1(clampX(from.x + Math.cos(angle) * passDistance * dir + rand(-miss, miss)));
    const toY = r1(clampY(from.y + Math.sin(angle) * passDistance + rand(-miss, miss)));
    ball = { x: toX, y: toY };
    ev = {
      ...base,
      zone,
      type: "pass",
      team,
      player: p,
      target: t,
      passDistance,
      passAccurate,
      passDifficulty,
      ballSpeed: Math.round(rand(35, 85)),
      importance: passDifficulty > 7 && passAccurate ? 0.6 : 0.15,
      label: passAccurate ? `${p.name} → ${t.name} (${passDistance}m)` : `${p.name} misplaced pass`,
      ...from,
      toX,
      toY,
    };
  } else if (r < 0.66) {
    const def = opp(team);
    const p = pick(outfield(def));
    possession = def;
    const at = near(3);
    const zone = zoneOf(def, at.x);
    ball = at;
    ev = {
      ...base,
      zone,
      type: "tackle",
      team: def,
      player: p,
      importance: zone === "def" ? 0.45 : 0.3,
      label: `${p.name} wins it back`,
      ...at,
      toX: at.x,
      toY: at.y,
    };
  } else if (r < 0.8) {
    const def = opp(team);
    const p = pick(outfield(def));
    const at = near(4);
    ev = {
      ...base,
      zone: zoneOf(def, at.x),
      type: "pressure",
      team: def,
      player: p,
      importance: 0.25,
      label: `${p.name} presses high`,
      x: at.x,
      y: at.y,
      toX: s.ball.x,
      toY: s.ball.y,
    };
  } else if (r < 0.885) {
    const p = pick(outfield(team).filter((x) => ["ST", "AM", "RW", "LW", "CM"].includes(x.pos)));
    // Skewed like real shot maps: mostly low-quality chances, a few big ones (~0.2 mean).
    const xg = Math.round((0.02 + 0.55 * next() ** 2) * 100) / 100;
    const ballSpeed = Math.round(rand(70, 128));
    const goal = next() < xg;
    // Better chances come from closer in and more central.
    const dist = 6 + (1 - (xg - 0.02) / 0.55) * 22;
    const phi = rand(-0.85, 0.85) * (xg > 0.3 ? 0.5 : 1);
    const x = r1(absX(team, PITCH.length - dist * Math.cos(phi)));
    const y = r1(clampY(CENTRE.y + dist * Math.sin(phi)));
    const toX = absX(team, PITCH.length);
    const toY = r1(goal ? rand(30.8, 37.2) : rand(25, 43));
    if (goal) {
      score[team]++;
      possession = opp(team);
    }
    ball = goal ? { ...CENTRE } : { x: absX(team, PITCH.length - 6), y: CENTRE.y };
    ev = {
      ...base,
      zone: "att",
      type: goal ? "goal" : "shot",
      team,
      player: p,
      xg,
      ballSpeed,
      importance: goal ? 1 : xg > 0.3 ? 0.7 : 0.4,
      label: goal ? `GOAL! ${p.name} (${ballSpeed} km/h)` : `${p.name} shot · xG ${xg}`,
      x,
      y,
      toX,
      toY,
    };
  } else {
    team = next() < homeBias ? "home" : "away";
    const p = pick(outfield(team));
    possession = team;
    const at = startFor(team);
    ball = at;
    ev = {
      ...base,
      zone: zoneOf(team, at.x),
      type: "possession",
      team,
      player: p,
      importance: 0.2,
      label: `${TEAMS[team].short} regain control`,
      ...at,
      toX: at.x,
      toY: at.y,
    };
  }
  ev.runSpeed =
    Math.round(rand(14, ev.type === "tackle" || ev.type === "goal" ? 36 : 33) * 10) / 10;
  return {
    clock,
    possession,
    score,
    homeBias,
    seed: s.seed,
    rng: rngState(),
    seq: base.id,
    ball,
    events: [...s.events, ev].slice(-400),
  };
}

// ---------- Interpretation layer ----------
export function computeStats(events: MatchEvent[]) {
  const by = (t: TeamId, f: (e: MatchEvent) => boolean) =>
    events.filter((e) => e.team === t && f(e)).length;
  const passes = {
    home: by("home", (e) => e.type === "pass"),
    away: by("away", (e) => e.type === "pass"),
  };
  const acc = {
    home: by("home", (e) => e.type === "pass" && !!e.passAccurate),
    away: by("away", (e) => e.type === "pass" && !!e.passAccurate),
  };
  const totalPoss = passes.home + passes.away || 1;
  const xg = (t: TeamId) =>
    Math.round(
      events.filter((e) => e.team === t && e.xg).reduce((a, e) => a + (e.xg || 0), 0) * 100,
    ) / 100;
  const shots = {
    home: by("home", (e) => e.type === "shot" || e.type === "goal"),
    away: by("away", (e) => e.type === "shot" || e.type === "goal"),
  };
  const recent = events.slice(-20);
  const turnovers = recent.filter(
    (e) => (e.type === "pass" && !e.passAccurate) || e.type === "tackle",
  ).length;
  const chaos = Math.round((turnovers / Math.max(1, recent.length)) * 100);
  const pressure = {
    home: by("home", (e) => e.type === "pressure"),
    away: by("away", (e) => e.type === "pressure"),
  };
  const momentum = recent.reduce(
    (m, e) => m + (e.team === "home" ? 1 : -1) * (0.3 + e.importance),
    0,
  );
  const speeds = events
    .filter((e) => e.type === "shot" || e.type === "goal")
    .map((e) => e.ballSpeed || 0);
  const avgDiff = events
    .filter((e) => e.type === "pass")
    .reduce((a, e, _, arr) => a + (e.passDifficulty || 0) / arr.length, 0);
  return {
    possession: {
      home: Math.round((passes.home / totalPoss) * 100),
      away: 100 - Math.round((passes.home / totalPoss) * 100),
    },
    passes,
    passAcc: {
      home: Math.round((acc.home / (passes.home || 1)) * 100),
      away: Math.round((acc.away / (passes.away || 1)) * 100),
    },
    xg: { home: xg("home"), away: xg("away") },
    shots,
    pressure,
    chaos,
    control: 100 - chaos,
    momentum: Math.max(-10, Math.min(10, momentum)),
    topShotSpeed: speeds.length ? Math.max(...speeds) : 0,
    avgPassDifficulty: Math.round(avgDiff * 10) / 10,
    winProb: winProbability(events),
  };
}

function winProbability(events: MatchEvent[]) {
  const g = {
    home: events.filter((e) => e.type === "goal" && e.team === "home").length,
    away: events.filter((e) => e.type === "goal" && e.team === "away").length,
  };
  const d = g.home - g.away;
  const home = Math.max(5, Math.min(92, 42 + d * 22));
  const away = Math.max(4, Math.min(90, 32 - d * 20));
  return { home, away, draw: Math.max(3, 100 - home - away) };
}

export function playerStats(events: MatchEvent[], id: string) {
  const mine = events.filter((e) => e.player.id === id);
  const passes = mine.filter((e) => e.type === "pass");
  return {
    touches: mine.length,
    passes: passes.length,
    passAcc: passes.length
      ? Math.round((passes.filter((p) => p.passAccurate).length / passes.length) * 100)
      : 0,
    shots: mine.filter((e) => e.type === "shot" || e.type === "goal").length,
    goals: mine.filter((e) => e.type === "goal").length,
    tackles: mine.filter((e) => e.type === "tackle").length,
    distance: Math.round(mine.length * 0.38 * 10) / 10,
    topSpeed: mine.reduce((m, e) => Math.max(m, e.runSpeed || 0), 0),
    rating: Math.min(
      10,
      Math.round(
        (6 + mine.length * 0.05 + mine.filter((e) => e.type === "goal").length * 1.2) * 10,
      ) / 10,
    ),
  };
}

export function mvp(events: MatchEvent[]) {
  const scores = new Map<string, number>();
  events.forEach((e) =>
    scores.set(e.player.id, (scores.get(e.player.id) || 0) + 0.3 + e.importance * 2),
  );
  let best: Player = PLAYERS[4]!,
    v = -1;
  scores.forEach((s, id) => {
    if (s > v) {
      v = s;
      best = PLAYERS.find((p) => p.id === id) ?? best;
    }
  });
  return { player: best, score: Math.min(99, Math.round(50 + v)) };
}

// Deterministic explanation used instantly (AI enriches on top).
export function explain(e: MatchEvent, stats: ReturnType<typeof computeStats>): string {
  const side = TEAMS[e.team].name;
  if (e.type === "goal")
    return `${side} convert a ${e.xg} xG chance — ${e.xg! < 0.15 ? "a low-probability strike that flips the expected story" : "the reward for sustained territorial pressure"}.`;
  if (e.type === "shot" && e.xg! > 0.3)
    return `High-value chance (${e.xg} xG). ${side} are breaking lines in the final third.`;
  if (e.type === "tackle" && e.zone === "def")
    return `Last-line intervention — without it ${TEAMS[e.team === "home" ? "away" : "home"].short} had a clear run on goal.`;
  if (e.type === "pass" && (e.passDifficulty || 0) > 7)
    return `Difficulty ${e.passDifficulty}/10 pass — elite vision that bypasses the press.`;
  if (stats.chaos > 45)
    return `Game is in a chaos phase (${stats.chaos}% turnover rate) — neither side can settle rhythm.`;
  return `${side} build patiently; control index at ${stats.control}%.`;
}

// Threshold-triggered player tags (speed & distance)
export const SPEED_TAG_KMH = 32;
export const DISTANCE_TAG_KM = [2, 4, 6];
export function playerTag(events: MatchEvent[], e: MatchEvent): string | null {
  if ((e.runSpeed || 0) >= SPEED_TAG_KMH) return `${e.player.name} · sprint ${e.runSpeed} km/h`;
  const before = playerStats(events.slice(0, -1), e.player.id).distance;
  const now = playerStats(events, e.player.id).distance;
  const hit = DISTANCE_TAG_KM.find((d) => before < d && now >= d);
  return hit ? `${e.player.name} · ${hit} km covered` : null;
}
