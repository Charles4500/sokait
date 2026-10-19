// Server-side match sessions. One session = one live synthetic match that every
// viewer and overlay partner shares. Import only from server route handlers.
import {
  initialState,
  nextEvent,
  MATCH_LENGTH_S,
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
  | { type: "status"; gen: number; status: MatchStatus; seed: number; matchId: string };

type Listener = (m: HubMessage) => void;

export const DEFAULT_MATCH_ID = "main";
const DEFAULT_SEED = Number(process.env["MATCH_SEED"]) || 42;
const TICK_MS = Number(process.env["MATCH_TICK_MS"]) || 1100;
const MAX_SESSIONS = 20;

export class MatchSession {
  state: MatchState;
  status: MatchStatus = "live";
  /** Bumped on restart so clients holding an old Last-Event-ID know to reset. */
  gen = 1;
  private log: Extract<HubMessage, { type: "event" }>[] = [];
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly id: string,
    private seed: number,
    private tickMs = TICK_MS,
  ) {
    this.state = initialState(seed);
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
    if (this.state.clock >= MATCH_LENGTH_S) this.setStatus("finished");
  }

  pause() {
    if (this.status === "live") this.setStatus("paused");
  }

  resume() {
    if (this.status === "paused") this.setStatus("live");
  }

  restart(seed = this.seed) {
    this.seed = seed;
    this.gen++;
    this.state = initialState(seed);
    this.log = [];
    this.status = "live";
    this.emit(this.statusMessage());
  }

  dispose() {
    if (this.timer) clearInterval(this.timer);
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
 * The shared broadcast match, or a private replay when a seed is given
 * (`?seed=7` → session "seed-7"), so demos and evaluations are reproducible.
 */
export function getSession(seed?: number): MatchSession {
  const id = seed === undefined ? DEFAULT_MATCH_ID : `seed-${seed}`;
  let s = sessions.get(id);
  if (!s) {
    if (sessions.size >= MAX_SESSIONS) evictOne();
    s = new MatchSession(id, seed ?? DEFAULT_SEED);
    sessions.set(id, s);
  }
  return s;
}

function evictOne() {
  // Prefer finished replays, then the oldest replay. Never evict the main match.
  const replays = [...sessions.values()].filter((s) => s.id !== DEFAULT_MATCH_ID);
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
