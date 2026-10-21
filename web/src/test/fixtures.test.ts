import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLUBS,
  FIXTURES,
  ROUNDS,
  fixtureById,
  initialState,
  nextEvent,
  playersOf,
  sideOf,
} from "@/match/engine";
import { getSession, liveSessions, upcomingFixtures } from "@/match/hub";

describe("fixtures playing at the same time", () => {
  afterEach(() => liveSessions().forEach((s) => s.dispose()));

  it("plays each fixture with its own clubs and squads", () => {
    for (const f of FIXTURES) {
      let s = initialState(f.seed, f);
      for (let i = 0; i < 60; i++) s = nextEvent(s);
      const squad = new Set(playersOf(f).map((p) => p.id));
      expect(s.events.every((e) => squad.has(e.player.id))).toBe(true);
      expect(s.events.every((e) => !e.target || squad.has(e.target.id))).toBe(true);
    }
  });

  it("keeps player ids unique across the league", () => {
    // A player keeps one id across all his club's fixtures; no two players share one.
    const byId = new Map<string, string>();
    for (const p of FIXTURES.flatMap(playersOf)) {
      expect(byId.get(p.id) ?? p.name).toBe(p.name);
      byId.set(p.id, p.name);
    }
    expect(byId.size).toBe(CLUBS.reduce((n, c) => n + c.squad.length, 0));
  });

  it("knows which side a club plays on, if it plays at all", () => {
    const f = fixtureById("sev-pen");
    expect(sideOf(f, "sev")).toBe("home");
    expect(sideOf(f, "pen")).toBe("away");
    expect(sideOf(f, "thr")).toBeNull();
    expect(fixtureById("nope").id).toBe("main");
  });

  it("runs one shared session per fixture, and replays separately", () => {
    const a = getSession(undefined, "sev-pen");
    expect(getSession(undefined, "sev-pen")).toBe(a);
    expect(getSession(undefined, "avo-tyn")).not.toBe(a);
    expect(getSession(5, "sev-pen").id).toBe("sev-pen:seed-5");
    expect(a.statusMessage()).toMatchObject({ fixtureId: "sev-pen", matchId: "sev-pen" });
    expect(liveSessions().map((s) => s.fixture.id)).toEqual(ROUNDS[0]!.map((f) => f.id));
  });
});

describe("a matchday that never runs dry", () => {
  it("kicks fixtures off at different minutes", () => {
    const minutes = liveSessions().map((s) => Math.floor(s.state.clock / 60));
    expect(new Set(minutes).size).toBe(minutes.length);
    liveSessions().forEach((s) => s.dispose());
  });

  it("moves each channel on to its next fixture after full time", () => {
    vi.useFakeTimers();
    const before = liveSessions()[1]!;
    before.fastForward(1000);
    expect(before.status).toBe("finished");
    vi.advanceTimersByTime(60_000);
    const after = liveSessions()[1]!;
    expect(after.fixture.id).toBe(ROUNDS[1]![1]!.id);
    expect(after.status).toBe("live");
    expect(getSession(undefined, before.fixture.id)).toBe(before); // still watchable at FT
    vi.useRealTimers();
  });
});

describe("the season schedule", () => {
  it("is a full round-robin: every club plays every other exactly once", () => {
    const pairs = FIXTURES.map((f) => [f.home.id, f.away.id].sort().join("-"));
    expect(new Set(pairs).size).toBe((CLUBS.length * (CLUBS.length - 1)) / 2);
    for (const round of ROUNDS) {
      const clubs = round.flatMap((f) => [f.home.id, f.away.id]);
      expect(new Set(clubs).size).toBe(CLUBS.length); // nobody plays twice in a round
    }
  });

  it("lists upcoming fixtures in kick-off order, none of them live", () => {
    const live = new Set(liveSessions().map((s) => s.fixture.id));
    const up = upcomingFixtures();
    expect(up.length).toBeGreaterThan(0);
    expect(up.every((u) => !live.has(u.id))).toBe(true);
    expect(up.map((u) => u.kickoffAt)).toEqual(
      [...up.map((u) => u.kickoffAt)].sort((a, b) => a - b),
    );
    liveSessions().forEach((s) => s.dispose());
  });
});
