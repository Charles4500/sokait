import { describe, expect, it } from "vitest";
import {
  depth,
  initialState,
  nextEvent,
  MATCH_LENGTH_S,
  PITCH,
  type MatchEvent,
} from "@/match/engine";

const fullMatch = (seed: number): MatchEvent[] => {
  let s = initialState(seed);
  while (s.clock < MATCH_LENGTH_S) s = nextEvent(s);
  return s.events;
};
const events = [1, 2, 3, 4, 5].flatMap(fullMatch);
const onPitch = (x: number, y: number) => x >= 0 && x <= PITCH.length && y >= 0 && y <= PITCH.width;

describe("event positions", () => {
  it("keeps every event and its end point on the pitch", () => {
    for (const e of events) {
      expect(onPitch(e.x, e.y), `${e.label} start`).toBe(true);
      expect(onPitch(e.toX, e.toY), `${e.label} end`).toBe(true);
    }
  });

  it("puts shots in the attacking third, aimed at the opponent's goal", () => {
    const shots = events.filter((e) => e.type === "shot" || e.type === "goal");
    expect(shots.length).toBeGreaterThan(20);
    for (const s of shots) {
      expect(depth(s.team, s.x)).toBeGreaterThan(70);
      expect(s.toX).toBe(s.team === "home" ? PITCH.length : 0);
      expect(s.zone).toBe("att");
    }
  });

  it("lands goals between the posts", () => {
    for (const g of events.filter((e) => e.type === "goal")) {
      expect(g.toY).toBeGreaterThanOrEqual(30.8);
      expect(g.toY).toBeLessThanOrEqual(37.2);
    }
  });

  it("gives higher-xG shots from closer to goal", () => {
    const shots = events.filter((e) => e.xg !== undefined);
    const dist = (e: MatchEvent) => Math.hypot(PITCH.length - depth(e.team, e.x), e.y - 34);
    const big = shots.filter((e) => e.xg! >= 0.3);
    const small = shots.filter((e) => e.xg! < 0.1);
    const avg = (xs: MatchEvent[]) => xs.reduce((a, e) => a + dist(e), 0) / xs.length;
    expect(avg(big)).toBeLessThan(avg(small));
  });

  it("matches accurate pass length to passDistance (unless the touchline clips it)", () => {
    const passes = events.filter((e) => e.type === "pass" && e.passAccurate);
    const close = passes.filter(
      (e) => Math.abs(Math.hypot(e.toX - e.x, e.toY - e.y) - e.passDistance!) < 1,
    );
    expect(close.length / passes.length).toBeGreaterThan(0.8);
  });

  it("derives the zone from where the event happened", () => {
    for (const e of events.filter((e) => e.type === "pass" || e.type === "tackle")) {
      const a = depth(e.team, e.x);
      const zone = a < 35 ? "def" : a < 70 ? "mid" : "att";
      expect(e.zone).toBe(zone);
    }
  });
});
