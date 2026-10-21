// Server-side match sessions. One session = one live synthetic match that every
// viewer and overlay partner shares. Import only from server route handlers.
import {
  FIXTURES,
  fixtureById,
  initialState,
  nextEvent,
  MATCH_LENGTH_S,
  type Fixture,
  type MatchEvent,
  type MatchState,
  type TeamId,
} from "@/match/engine";

export type MatchStatus = "live" | "paused" | "finished";

export type HubMessage =
  | {
      type: "event";
      gen: number;
      seq: number;
      clock: number;
      score: Record<TeamId, number>;
      event: MatchEvent;
    }
  | {
      type: "status";
      gen: number;
      status: MatchStatus;
      seed: number;
      matchId: string;
      fixtureId: string;
    };

type Listener = (m: HubMessage) => void;

export const DEFAULT_MATCH_ID = "main";
const DEFAULT_SEED = Number(process.env["MATCH_SEED"]) || 42;
const TICK_MS = Number(process.env["MATCH_TICK_MS"]) || 1100;
const MAX_SESSIONS = 20;
/** Shared matches kick off again this long after full time, so something is always live. */
const RESTART_AFTER_MS = Number(process.env["MATCH_RESTART_MS"] ?? 45000);
/** Fixtures kick off at different times, like a real matchday (events already played). */
const KICKOFF_STAGGER_EVENTS = 55;

export class MatchSession {
  state: MatchState;
  status: MatchStatus = "live";
  /** Bumped on restart so clients holding an old Last-Event-ID know to reset. */
  gen = 1;
  private log: Extract<HubMessage, { type: "event" }>[] = [];
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set for shared matches: kick off a new game this long after full time. */
  autoRestartMs = 0;

  constructor(
    readonly id: string,
    private seed: number,
    private tickMs = TICK_MS,
    readonly fixture: Fixture = FIXTURES[0]!,
  ) {
    this.state = initialState(seed, fixture);
    this.startTimer();
  }

  get currentSeed() {
    return this.seed;
  }

  statusMessage(): HubMessage {
    return {
      type: "status",
      gen: this.gen,
      status: this.status,
      seed: this.seed,
      matchId: this.id,
      fixtureId: this.fixture.id,
    };
  }

  /** Events after `afterSeq` in the current generation (all of them if the gen changed). */
  replay(gen: number | null, afterSeq: number) {
    const from = gen === this.gen ? afterSeq : 0;
    return this.log.filter((m) => m.seq > from);
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Advance one event. Exposed for tests; the timer calls it in normal operation. */
  tick() {
    if (this.status !== "live") return;
    this.state = nextEvent(this.state);
    const event = this.state.events[this.state.events.length - 1]!;
    const msg = {
      type: "event" as const,
      gen: this.gen,
      seq: this.state.seq,
      clock: this.state.clock,
      score: this.state.score,
      event,
    };
    this.log.push(msg);
    this.emit(msg);
    if (this.state.clock >= MATCH_LENGTH_S) {
      this.setStatus("finished");
      if (this.autoRestartMs > 0)
        this.restartTimer = setTimeout(() => this.restart(this.seed + 1), this.autoRestartMs);
    }
  }

  /** Play `n` events instantly, e.g. so fixtures are at different minutes. */
  fastForward(n: number) {
    for (let i = 0; i < n && this.status === "live"; i++) this.tick();
  }

  pause() {
    if (this.status === "live") this.setStatus("paused");
  }

  resume() {
    if (this.status === "paused") this.setStatus("live");
  }

  restart(seed = this.seed) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    this.seed = seed;
    this.gen++;
    this.state = initialState(seed, this.fixture);
    this.log = [];
    this.status = "live";
    this.emit(this.statusMessage());
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.timer = null;
    this.listeners.clear();
  }

  private setStatus(status: MatchStatus) {
    this.status = status;
    this.emit(this.statusMessage());
  }

  private emit(m: HubMessage) {
    this.listeners.forEach((fn) => {
      try {
        fn(m);
      } catch {
        // A broken subscriber must not stop the match for everyone else.
      }
    });
  }

  private startTimer() {
    if (this.tickMs <= 0) return; // manual ticking (tests)
    this.timer = setInterval(() => this.tick(), this.tickMs);
  }
}

// Survive Vite HMR in dev: keep sessions on globalThis.
const g = globalThis as unknown as { __pitchpulseSessions?: Map<string, MatchSession> };
const sessions = (g.__pitchpulseSessions ??= new Map());

/**
 * A fixture's shared broadcast match (every fixture plays at the same time), or a
 * private replay of it when a seed is given (`?seed=7` → session "main:seed-7"), so
 * demos and evaluations are reproducible.
 */
export function getSession(seed?: number, fixtureId?: string | null): MatchSession {
  const fixture = fixtureById(fixtureId);
  const id = seed === undefined ? fixture.id : `${fixture.id}:seed-${seed}`;
  let s = sessions.get(id);
  if (!s) {
    if (sessions.size >= MAX_SESSIONS) evictOne();
    const shared = fixture.id === DEFAULT_MATCH_ID ? DEFAULT_SEED : fixture.seed;
    s = new MatchSession(id, seed ?? shared, TICK_MS, fixture);
    if (seed === undefined) {
      s.autoRestartMs = RESTART_AFTER_MS;
      s.fastForward(FIXTURES.indexOf(fixture) * KICKOFF_STAGGER_EVENTS);
    }
    sessions.set(id, s);
  }
  return s;
}

/** Every fixture's shared match, started if needed: the "Live now" list. */
export function liveSessions(): MatchSession[] {
  return FIXTURES.map((f) => getSession(undefined, f.id));
}

function evictOne() {
  // Prefer finished replays, then the oldest replay. Never evict a shared fixture.
  const shared = new Set(FIXTURES.map((f) => f.id));
  const replays = [...sessions.values()].filter((s) => !shared.has(s.id));
  const victim = replays.find((s) => s.status === "finished") ?? replays[0];
  if (!victim) return;
  victim.dispose();
  sessions.delete(victim.id);
}

/** Parse `?seed=` into a safe uint32, or undefined for the shared match. */
export function parseSeed(raw: string | null): number | undefined {
  if (raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : undefined;
}
