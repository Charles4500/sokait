import { describe, expect, it } from "vitest";
import { keyMomentLine, localAnswer, shortLine, where } from "@/listen/describe";
import { PLAYERS, initialState, nextEvent, type MatchEvent } from "@/match/engine";

const player = (id: string) => PLAYERS.find((p) => p.id === id)!;
const ev = (over: Partial<MatchEvent>): MatchEvent => ({
  id: 1,
  minute: 10,
  second: 0,
  type: "pass",
  team: "home",
  player: player("home-10"),
  zone: "mid",
  importance: 0.2,
  label: "",
  x: 50,
  y: 34,
  toX: 60,
  toY: 34,
  ...over,
});

describe("where", () => {
  it("speaks from the attacking team's point of view", () => {
    // Home attacks towards x=105; their left is the top touchline (small y).
    expect(where("home", 95, 10)).toBe("in the box, left side");
    // The same spot is the away side's own box, on their right.
    expect(where("away", 95, 10)).toBe("in their own box, right side");
    expect(where("home", 60, 34)).toBe("in midfield, centrally");
  });
});

describe("spoken lines", () => {
  it("keeps every-touch calls short", () => {
    const pass = ev({ passAccurate: true, target: player("home-9") });
    expect(shortLine(pass)).toBe("Vargas to Pike");
    expect(shortLine(ev({ type: "tackle", team: "away", player: player("away-3") }))).toBe(
      "Dunn wins it",
    );
  });

  it("announces goals with scorer, place and score", () => {
    const goal = ev({ type: "goal", x: 96, y: 30 });
    expect(keyMomentLine(goal, { home: 2, away: 1 })).toBe(
      "Goal for Thames Rovers! Nico Vargas scores in the box, centrally. It's Thames Rovers 2, Mersey Athletic 1.",
    );
  });
});

describe("local answers", () => {
  let s = initialState(5);
  for (let i = 0; i < 80; i++) s = nextEvent(s);
  const ctx = { events: s.events, score: s.score, minute: 30, favPlayer: "away-11" };

  it("answers common questions without the agent", () => {
    expect(localAnswer("What's the score?", ctx)).toMatch(/^It's Thames Rovers \d+, Mersey/);
    expect(localAnswer("where is the ball", ctx)).toMatch(/ have it (in|deep)/);
    expect(localAnswer("how is Mensah doing?", ctx)).toMatch(/^Eli Mensah has \d+ touches/);
    expect(localAnswer("how is my player doing", ctx)).toMatch(/^Eli Mensah has/);
  });

  it("leaves open questions to the agent", () => {
    expect(localAnswer("Why are we losing the midfield?", ctx)).toBeNull();
  });
});
