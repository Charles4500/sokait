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

/** A synthetic club and its matchday squad. */
export interface Club {
  id: string;
  name: string;
  short: string;
  squad: [name: string, num: number, pos: string][];
}

export const CLUBS: Club[] = [
  {
    id: "thr",
    name: "Thames Rovers",
    short: "THR",
    squad: [
      ["Leo Marlowe", 1, "GK"],
      ["Ade Okafor", 4, "CB"],
      ["Tom Reyes", 5, "CB"],
      ["Kai Brennan", 8, "CM"],
      ["Nico Vargas", 10, "AM"],
      ["Sami Hale", 7, "RW"],
      ["Jonah Pike", 9, "ST"],
    ],
  },
  {
    id: "mer",
    name: "Mersey Athletic",
    short: "MER",
    squad: [
      ["Ivo Kranz", 1, "GK"],
      ["Ollie Dunn", 3, "CB"],
      ["Rafa Sol", 6, "DM"],
      ["Max Ferro", 8, "CM"],
      ["Eli Mensah", 11, "LW"],
      ["Dario Lusk", 9, "ST"],
      ["Theo Quinn", 14, "AM"],
    ],
  },
  {
    id: "sev",
    name: "Severn United",
    short: "SEV",
    squad: [
      ["Bram Holt", 1, "GK"],
      ["Kofi Mensa", 5, "CB"],
      ["Luca Ferri", 4, "CB"],
      ["Owen Price", 6, "DM"],
      ["Rio Castell", 10, "AM"],
      ["Yusuf Amara", 11, "LW"],
      ["Finn Doyle", 9, "ST"],
    ],
  },
  {
    id: "pen",
    name: "Pennine City",
    short: "PEN",
    squad: [
      ["Mats Lund", 1, "GK"],
      ["Joel Banks", 2, "RB"],
      ["Idris Cole", 5, "CB"],
      ["Arlo Grey", 8, "CM"],
      ["Tiago Neves", 7, "RW"],
      ["Sol Adeyemi", 10, "AM"],
      ["Zane Archer", 9, "ST"],
    ],
  },
  {
    id: "avo",
    name: "Avon Wanderers",
    short: "AVO",
    squad: [
      ["Cal Fenwick", 1, "GK"],
      ["Dev Okoro", 4, "CB"],
      ["Rhys Moran", 3, "LB"],
      ["Pablo Ruiz", 8, "CM"],
      ["Kian Shaw", 10, "AM"],
      ["Malik Diop", 7, "RW"],
      ["Ezra Stone", 9, "ST"],
    ],
  },
  {
    id: "tyn",
    name: "Tyne Harbour",
    short: "TYN",
    squad: [
      ["Erik Dahl", 1, "GK"],
      ["Noel Grant", 5, "CB"],
      ["Sam Achebe", 6, "DM"],
      ["Leon Hart", 8, "CM"],
      ["Gio Romano", 11, "LW"],
      ["Ravi Patel", 10, "AM"],
      ["Beau Kerr", 9, "ST"],
    ],
  },
];

const club = (id: string) => CLUBS.find((c) => c.id === id)!;

/** A match between two clubs. Several fixtures play at the same time. */
export interface Fixture {
  id: string;
  home: Club;
  away: Club;
  seed: number;
}

const fx = (id: string, home: string, away: string, seed: number): Fixture => ({
  id,
  home: club(home),
  away: club(away),
  seed,
});

/** A full round-robin: every club plays every other once, three fixtures per round. */
export const ROUNDS: Fixture[][] = [
  [fx("main", "thr", "mer", 42), fx("sev-pen", "sev", "pen", 7), fx("avo-tyn", "avo", "tyn", 19)],
  [
    fx("thr-sev", "thr", "sev", 3),
    fx("mer-avo", "mer", "avo", 11),
    fx("pen-tyn", "pen", "tyn", 23),
  ],
  [
    fx("avo-thr", "avo", "thr", 5),
    fx("pen-mer", "pen", "mer", 13),
    fx("sev-tyn", "sev", "tyn", 29),
  ],
  [
    fx("thr-pen", "thr", "pen", 17),
    fx("tyn-mer", "tyn", "mer", 31),
    fx("sev-avo", "sev", "avo", 37),
  ],
  [
    fx("tyn-thr", "tyn", "thr", 41),
    fx("mer-sev", "mer", "sev", 43),
    fx("pen-avo", "pen", "avo", 47),
  ],
];

/** Fixtures play on parallel channels; each channel works through its column of rounds. */
export const CHANNELS = ROUNDS[0]!.length;

export const FIXTURES: Fixture[] = ROUNDS.flat();

/** The channel a fixture plays on, and its round. */
export function slotOf(fixtureId: string): { channel: number; round: number } {
  for (let round = 0; round < ROUNDS.length; round++) {
    const channel = ROUNDS[round]!.findIndex((f) => f.id === fixtureId);
    if (channel >= 0) return { channel, round };
  }
  return { channel: 0, round: 0 };
}

export const fixtureById = (id: string | null | undefined) =>
  FIXTURES.find((f) => f.id === id) ?? FIXTURES[0]!;

export type Teams = Record<TeamId, { id: string; name: string; short: string; color: string }>;

export function teamsOf(f: Fixture): Teams {
  return {
    home: { id: f.home.id, name: f.home.name, short: f.home.short, color: "var(--team-home)" },
    away: { id: f.away.id, name: f.away.name, short: f.away.short, color: "var(--team-away)" },
  };
}

export function playersOf(f: Fixture): Player[] {
  const side = (team: TeamId, c: Club) =>
    c.squad.map(([name, num, pos]) => ({ id: `${c.id}-${num}`, name, num, pos, team }));
  return [...side("home", f.home), ...side("away", f.away)];
}

/** The side a club plays on in this fixture, or null if it isn't playing in it. */
export const sideOf = (f: Fixture, clubId: string): TeamId | null =>
  f.home.id === clubId ? "home" : f.away.id === clubId ? "away" : null;

// The default fixture, for tests and tools.
export const TEAMS = teamsOf(FIXTURES[0]!);
export const PLAYERS: Player[] = playersOf(FIXTURES[0]!);

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

const outfield = (f: Fixture, t: TeamId) =>
  playersOf(f).filter((p) => p.team === t && p.pos !== "GK");

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
  fixture: Fixture;
}

export const MATCH_LENGTH_S = 90 * 60;

export const initialState = (seed = 42, fixture: Fixture = FIXTURES[0]!): MatchState => ({
  clock: 0,
  possession: "home",
  score: { home: 0, away: 0 },
  events: [],
  homeBias: 0.52,
  seed,
  rng: seed >>> 0,
  seq: 0,
  ball: { ...CENTRE },
  fixture,
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
    const p = pick(outfield(s.fixture, team));
    let t = pick(outfield(s.fixture, team));
    if (t.id === p.id) t = pick(outfield(s.fixture, team));
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
    const p = pick(outfield(s.fixture, def));
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
    const p = pick(outfield(s.fixture, def));
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
    const p = pick(
      outfield(s.fixture, team).filter((x) => ["ST", "AM", "RW", "LW", "CM"].includes(x.pos)),
    );
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
    const p = pick(outfield(s.fixture, team));
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
      label: `${teamsOf(s.fixture)[team].short} regain control`,
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
    fixture: s.fixture,
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

export function mvp(events: MatchEvent[], players: Player[] = PLAYERS) {
  const scores = new Map<string, number>();
  events.forEach((e) =>
    scores.set(e.player.id, (scores.get(e.player.id) || 0) + 0.3 + e.importance * 2),
  );
  let best: Player = players[4]!,
    v = -1;
  scores.forEach((s, id) => {
    if (s > v) {
      v = s;
      best = players.find((p) => p.id === id) ?? best;
    }
  });
  return { player: best, score: Math.min(99, Math.round(50 + v)) };
}

// Deterministic explanation used instantly (AI enriches on top).
export function explain(
  e: MatchEvent,
  stats: ReturnType<typeof computeStats>,
  teams: Teams = TEAMS,
): string {
  const side = teams[e.team].name;
  if (e.type === "goal")
    return `${side} convert a ${e.xg} xG chance — ${e.xg! < 0.15 ? "a low-probability strike that flips the expected story" : "the reward for sustained territorial pressure"}.`;
  if (e.type === "shot" && e.xg! > 0.3)
    return `High-value chance (${e.xg} xG). ${side} are breaking lines in the final third.`;
  if (e.type === "tackle" && e.zone === "def")
    return `Last-line intervention — without it ${teams[e.team === "home" ? "away" : "home"].short} had a clear run on goal.`;
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
