// Server-side match sessions. One session = one live synthetic match that every
// viewer and overlay partner shares. Import only from server route handlers.
import {
  CHANNELS,
  FIXTURES,
  ROUNDS,
  fixtureById,
  slotOf,
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
/** Break between full time and the next fixture on the same channel. */
const BREAK_MS = Number(process.env["MATCH_RESTART_MS"] ?? 45000);
/** Channels kick off at different times, like a real matchday (events already played). */
const KICKOFF_STAGGER_EVENTS = 55;
/** Match time advanced per event, on average (see nextEvent): for kick-off estimates. */
const AVG_EVENT_S = 30;

export class MatchSession {
  state: MatchState;
  status: MatchStatus = "live";
  /** Bumped on restart so clients holding an old Last-Event-ID know to reset. */
  gen = 1;
  private log: Extract<HubMessage, { type: "event" }>[] = [];
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Called once at full time (the hub uses it to schedule the channel's next fixture). */
  onFinished: (() => void) | null = null;

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
      this.onFinished?.();
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
    this.seed = seed;
    this.gen++;
    this.state = initialState(seed, this.fixture);
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

// Survive Vite HMR in dev: keep sessions and channels on globalThis.
interface Channel {
  index: number;
  round: number;
  cycle: number;
  session: MatchSession;
  /** When the next fixture kicks off, once this one has finished. */
  nextAt: number | null;
}
const g = globalThis as unknown as {
  __pitchpulseSessions?: Map<string, MatchSession>;
  __pitchpulseChannels?: Channel[];
};
const sessions = (g.__pitchpulseSessions ??= new Map());

function startFixture(ch: Omit<Channel, "session" | "nextAt">, stagger: number): Channel {
  const fixture = ROUNDS[ch.round]![ch.index]!;
  const base = fixture.id === DEFAULT_MATCH_ID ? DEFAULT_SEED : fixture.seed;
  const session = new MatchSession(fixture.id, base + ch.cycle * 1000, TICK_MS, fixture);
  sessions.get(fixture.id)?.dispose();
  sessions.set(fixture.id, session);
  const channel: Channel = { ...ch, session, nextAt: null };
  session.onFinished = () => {
    channel.nextAt = Date.now() + BREAK_MS;
    setTimeout(() => advance(channel), BREAK_MS);
  };
  session.fastForward(stagger);
  return channel;
}

function advance(ch: Channel) {
  const round = (ch.round + 1) % ROUNDS.length;
  const next = startFixture(
    { index: ch.index, round, cycle: round === 0 ? ch.cycle + 1 : ch.cycle },
    0,
  );
  g.__pitchpulseChannels![ch.index] = next;
}

/** The parallel channels, started on first use with staggered kick-offs. */
function channels(): Channel[] {
  g.__pitchpulseChannels ??= Array.from({ length: CHANNELS }, (_, index) =>
    startFixture({ index, round: 0, cycle: 0 }, index * KICKOFF_STAGGER_EVENTS),
  );
  return g.__pitchpulseChannels;
}

/**
 * A fixture's shared broadcast match, or a private replay of it when a seed is given
 * (`?seed=7` → session "main:seed-7"), so demos and evaluations are reproducible.
 * A fixture that hasn't kicked off yet resolves to whatever is live on its channel.
 */
export function getSession(seed?: number, fixtureId?: string | null): MatchSession {
  const fixture = fixtureById(fixtureId);
  if (seed === undefined) {
    const chs = channels();
    return sessions.get(fixture.id) ?? chs[slotOf(fixture.id).channel]!.session;
  }
  const id = `${fixture.id}:seed-${seed}`;
  let s = sessions.get(id);
  if (!s) {
    if (sessions.size >= MAX_SESSIONS) evictOne();
    s = new MatchSession(id, seed, TICK_MS, fixture);
    sessions.set(id, s);
  }
  return s;
}

/** The match on each channel right now (live, or at full time before the next one). */
export function liveSessions(): MatchSession[] {
  return channels().map((c) => c.session);
}

export interface Upcoming {
  id: string;
  home: string;
  away: string;
  channel: number;
  /** Estimated kick-off, ms since epoch. */
  kickoffAt: number;
}

/** The next fixtures on every channel, with estimated kick-off times. */
export function upcomingFixtures(perChannel = 2): Upcoming[] {
  const now = Date.now();
  const matchMs = (MATCH_LENGTH_S / AVG_EVENT_S) * TICK_MS;
  return channels()
    .flatMap((ch) => {
      const s = ch.session;
      const remaining =
        ch.nextAt !== null
          ? ch.nextAt - now
          : Math.max(0, (MATCH_LENGTH_S - s.state.clock) / AVG_EVENT_S) * TICK_MS + BREAK_MS;
      return Array.from({ length: perChannel }, (_, k) => {
        const f = ROUNDS[(ch.round + 1 + k) % ROUNDS.length]![ch.index]!;
        return {
          id: f.id,
          home: f.home.id,
          away: f.away.id,
          channel: ch.index,
          kickoffAt: Math.round(now + remaining + k * (matchMs + BREAK_MS)),
        };
      });
    })
    .sort((a, b) => a.kickoffAt - b.kickoffAt);
}

function evictOne() {
  // Only private replays are evicted; channel matches are managed by the schedule.
  const replays = [...sessions.values()].filter((s) => s.id.includes(":seed-"));
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
