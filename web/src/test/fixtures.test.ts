import { afterEach, describe, expect, it } from "vitest";
import { FIXTURES, fixtureById, initialState, nextEvent, playersOf, sideOf } from "@/match/engine";
import { getSession, liveSessions } from "@/match/hub";

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
    const ids = FIXTURES.flatMap((f) => playersOf(f).map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
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
    expect(liveSessions().map((s) => s.fixture.id)).toEqual(FIXTURES.map((f) => f.id));
  });
});

describe("a matchday that never runs dry", () => {
  it("kicks fixtures off at different minutes", () => {
    const minutes = liveSessions().map((s) => Math.floor(s.state.clock / 60));
    expect(new Set(minutes).size).toBe(minutes.length);
    liveSessions().forEach((s) => s.dispose());
  });

  it("restarts a shared match after full time with a new game", async () => {
    const { MatchSession } = await import("@/match/hub");
    const s = new MatchSession("t", 3, 0, FIXTURES[1]);
    s.autoRestartMs = 10;
    s.fastForward(1000);
    expect(s.status).toBe("finished");
    await new Promise((r) => setTimeout(r, 30));
    expect(s.status).toBe("live");
    expect(s.gen).toBe(2);
    expect(s.currentSeed).toBe(4);
    s.dispose();
  });
});
