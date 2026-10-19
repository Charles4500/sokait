import { describe, expect, it } from "vitest";
import { initialState, nextEvent, MATCH_LENGTH_S } from "@/match/engine";
import { MatchSession, parseSeed, type HubMessage } from "@/match/hub";

const play = (seed: number, n: number) => {
  let s = initialState(seed);
  for (let i = 0; i < n; i++) s = nextEvent(s);
  return s;
};

describe("seeded match engine", () => {
  it("replays the same match for the same seed", () => {
    expect(play(7, 120)).toEqual(play(7, 120));
  });

  it("produces different matches for different seeds", () => {
    expect(play(7, 50).events.map((e) => e.label)).not.toEqual(
      play(8, 50).events.map((e) => e.label),
    );
  });

  it("is pure: the input state is not changed", () => {
    const s = play(3, 10);
    const copy = structuredClone(s);
    nextEvent(s);
    expect(s).toEqual(copy);
  });

  it("numbers events from 1 in every new match", () => {
    expect(play(1, 3).events.map((e) => e.id)).toEqual([1, 2, 3]);
  });
});

describe("MatchSession", () => {
  const session = (seed = 42) => new MatchSession("test", seed, 0); // 0 = manual ticks

  it("broadcasts events to subscribers", () => {
    const s = session();
    const got: HubMessage[] = [];
    s.subscribe((m) => got.push(m));
    s.tick();
    s.tick();
    expect(got.map((m) => m.type)).toEqual(["event", "event"]);
  });

  it("replays only missed events in the same generation", () => {
    const s = session();
    for (let i = 0; i < 5; i++) s.tick();
    expect(s.replay(s.gen, 3).map((m) => m.seq)).toEqual([4, 5]);
    expect(s.replay(null, 0)).toHaveLength(5);
  });

  it("replays everything when the client holds an old generation", () => {
    const s = session();
    for (let i = 0; i < 4; i++) s.tick();
    const oldGen = s.gen;
    s.restart();
    s.tick();
    s.tick();
    expect(s.gen).toBe(oldGen + 1);
    expect(s.replay(oldGen, 4).map((m) => m.seq)).toEqual([1, 2]);
  });

  it("restart with the same seed replays the same events", () => {
    const s = session(9);
    s.tick();
    s.tick();
    const first = s.replay(null, 0).map((m) => m.event.label);
    s.restart();
    s.tick();
    s.tick();
    expect(s.replay(null, 0).map((m) => m.event.label)).toEqual(first);
  });

  it("does not advance while paused", () => {
    const s = session();
    s.tick();
    s.pause();
    s.tick();
    expect(s.state.events).toHaveLength(1);
    s.resume();
    s.tick();
    expect(s.state.events).toHaveLength(2);
  });

  it("finishes at full time", () => {
    const s = session();
    for (let i = 0; i < 1000 && s.status === "live"; i++) s.tick();
    expect(s.status).toBe("finished");
    expect(s.state.clock).toBeGreaterThanOrEqual(MATCH_LENGTH_S);
  });

  it("keeps broadcasting when one subscriber throws", () => {
    const s = session();
    let ok = 0;
    s.subscribe(() => {
      throw new Error("broken client");
    });
    s.subscribe(() => ok++);
    s.tick();
    expect(ok).toBe(1);
  });
});

describe("parseSeed", () => {
  it("accepts uint32 seeds and rejects everything else", () => {
    expect(parseSeed("42")).toBe(42);
    expect(parseSeed(null)).toBeUndefined();
    expect(parseSeed("")).toBeUndefined();
    expect(parseSeed("-1")).toBeUndefined();
    expect(parseSeed("1.5")).toBeUndefined();
    expect(parseSeed("abc")).toBeUndefined();
    expect(parseSeed(String(2 ** 32))).toBeUndefined();
  });
});
