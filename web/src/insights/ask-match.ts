// Answers a fan's question about the live match: on the device when it's a common one
// (score, time, where the ball is, how a player is doing), otherwise by the Match Q&A
// agent, which is fact-checked like every overlay. Used by the chat and by Listen.
import { computeStats, playerStats, type MatchEvent, type TeamId } from "@/match/engine";
import { clubName, type FixtureInfo } from "@/match/fixture-context";
import { localAnswer } from "@/listen/describe";
import { askMatch, type Persona, type Verification } from "./agents.functions";

export interface AskContext {
  events: MatchEvent[];
  score: Record<TeamId, number>;
  minute: number;
  matchId: string;
  gen: number;
  info: FixtureInfo;
  lang: string;
  persona: Persona;
  favClub: string;
  favPlayer: string;
}

export interface AskResult {
  answer: string;
  /** "device": answered locally with no model call; "fallback": the agent was unavailable. */
  source: "device" | "agent" | "fallback";
  verification?: Verification;
}

export const ASK_FALLBACK =
  "Sorry, I can't answer that right now. Try asking for the score, the time, or how a player is doing.";

export async function askAboutMatch(question: string, ctx: AskContext): Promise<AskResult> {
  const { teams, players } = ctx.info;
  const local = localAnswer(question, {
    events: ctx.events,
    score: ctx.score,
    minute: ctx.minute,
    favPlayer: ctx.favPlayer,
    teams,
    players,
  });
  if (local) return { answer: local, source: "device" };

  const fav = players.find((x) => x.id === ctx.favPlayer);
  const recent = ctx.events.slice(-60).filter((e) => e.importance >= 0.4);
  const involved = new Set([fav?.id, ...recent.slice(-3).map((e) => e.player.id)]);
  const statsByName = Object.fromEntries(
    players.filter((x) => involved.has(x.id)).map((x) => [x.name, playerStats(ctx.events, x.id)]),
  );
  const r = await askMatch({
    data: {
      match_id: ctx.matchId,
      moment_id: `${ctx.gen}:${ctx.events[ctx.events.length - 1]?.id ?? 0}`,
      minute: ctx.minute,
      score: ctx.score,
      stats: computeStats(ctx.events),
      teams: { home: teams.home, away: teams.away },
      segment: {
        persona: ctx.persona,
        language: ctx.lang,
        favourite_player: fav?.name ?? null,
        favourite_club: clubName(ctx.favClub),
      },
      question,
      recent_events: recent.slice(-10).map((e) => `${e.minute}' ${e.label}`),
      extra: { players: statsByName },
    },
  }).catch(() => ({ ok: false as const, error: "unavailable" }));
  if (!r.ok || r.data.verification.status === "fallback")
    return { answer: r.ok ? r.data.answer : ASK_FALLBACK, source: "fallback" };
  return { answer: r.data.answer, source: "agent", verification: r.data.verification };
}
