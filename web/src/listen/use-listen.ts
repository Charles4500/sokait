import { useCallback, useEffect, useRef, useState } from "react";
import { computeStats, playerStats } from "@/match/engine";
import { clubName, favSide, type FixtureInfo } from "@/match/fixture-context";
import type { MatchStatus } from "@/match/hub";
import type { MatchView } from "@/match/use-match-stream";
import { analyseMoment, type Segment } from "@/insights/agents.functions";
import { askAboutMatch } from "@/insights/ask-match";
import { keyMomentLine, localAnswer, scoreLine, shortLine, where } from "./describe";
import { SpatialPitch } from "./spatial-audio";
import { Announcer, type Priority } from "./voice";

export type Detail = "goals" | "key" | "every";

export interface ListenPrefs {
  lang: string;
  /** Club id; if it isn't in this match, the home side attacks to the right. */
  favClub: string;
  favPlayer: string;
  detail: Detail;
  rate: number;
  ballSound: boolean;
  screenReader: boolean;
}

export interface Spoken {
  id: number;
  text: string;
  priority: Priority;
  kind: "match" | "ai" | "you" | "answer";
}

const AI_COOLDOWN_MS = 6000;
const STALE_MS = 10000; // AI narration older than this is no longer worth saying

/**
 * PitchPulse Listen: follows the live match through sound and speech.
 * Spatial earcons for every event, spoken key moments (instant deterministic line,
 * then verified AI narration), and spoken answers to voice questions.
 */
export function useListen(
  state: MatchView,
  status: MatchStatus,
  gen: number,
  matchId: string,
  prefs: ListenPrefs,
  info: FixtureInfo,
) {
  const { teams, players } = info;
  const side = favSide(info, prefs.favClub) ?? "home";
  const audio = useRef<SpatialPitch | null>(null);
  const announcer = useRef<Announcer | null>(null);
  const [started, setStarted] = useState(false);
  const [log, setLog] = useState<Spoken[]>([]);
  const [voiceUnavailable, setVoiceUnavailable] = useState(false);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const nextId = useRef(0);

  const minute = Math.min(90, Math.floor(state.clock / 60));
  const push = useCallback((text: string, priority: Priority, kind: Spoken["kind"]) => {
    setLog((l) => [{ id: nextId.current++, text, priority, kind }, ...l].slice(0, 40));
  }, []);
  const say = useCallback(
    (text: string, priority: Priority = "normal", kind: Spoken["kind"] = "match") => {
      push(text, priority, kind);
      announcer.current?.say(text, priority);
    },
    [push],
  );

  // Keep the engines in step with the viewer's settings.
  useEffect(() => {
    const a = announcer.current;
    if (a) {
      a.language = prefs.lang;
      a.rate = prefs.rate;
      a.screenReader = prefs.screenReader;
    }
    audio.current?.setFavClub(side);
    audio.current?.setBallSound(prefs.ballSound);
  }, [prefs, side]);

  const start = useCallback(async () => {
    audio.current ??= new SpatialPitch();
    announcer.current ??= new Announcer();
    announcer.current.onUnavailable = () => setVoiceUnavailable(true);
    const p = prefsRef.current;
    Object.assign(announcer.current, {
      language: p.lang,
      rate: p.rate,
      screenReader: p.screenReader,
    });
    await audio.current.start(side);
    audio.current.setBallSound(p.ballSound);
    setStarted(true);
    say(
      `Listening to ${teams.home.name} against ${teams.away.name}. ${teams[side].name} attack to your right. It's ${scoreLine(state.score, teams)}, minute ${minute}.`,
      "high",
    );
  }, [say, state.score, minute, teams, side]);

  const stop = useCallback(() => {
    audio.current?.stop();
    audio.current = null;
    announcer.current?.stop();
    setStarted(false);
  }, []);
  useEffect(() => stop, [stop]);

  // ---- match events → sound and speech ----
  const seen = useRef(0);
  const stream = `${matchId}#${gen}`;
  const seenGen = useRef(stream);
  const lastAi = useRef(0);
  const lastGoalAt = useRef(0);

  useEffect(() => {
    if (seenGen.current !== stream) {
      const switched = !seenGen.current.startsWith(`${matchId}#`);
      seenGen.current = stream;
      seen.current = 0;
      if (started)
        say(
          switched
            ? `Now listening to ${teams.home.name} against ${teams.away.name}.`
            : "The match has restarted.",
          "high",
        );
    }
    const added = state.events.length - seen.current;
    seen.current = state.events.length;
    if (!started || added <= 0) return;
    if (added > 1) return; // catch-up batch: covered by the welcome line

    const e = state.events[state.events.length - 1]!;
    const p = prefsRef.current;
    audio.current?.moveBall(e.toX, e.toY);
    audio.current?.earcon(e.type, e.team, e.x, e.y);

    const isGoal = e.type === "goal";
    const isKey = e.importance >= 0.6 || (e.player.id === p.favPlayer && e.importance >= 0.3);
    if (isGoal) lastGoalAt.current = Date.now();

    if (p.detail === "goals" && !isGoal) return;
    if (!isKey && !isGoal) {
      if (p.detail === "every") say(shortLine(e, teams), "low");
      return;
    }
    say(keyMomentLine(e, state.score, teams), isGoal ? "high" : "normal");

    // Verified AI narration explains why it matters (audio persona: says where).
    if (Date.now() - lastAi.current < AI_COOLDOWN_MS) return;
    lastAi.current = Date.now();
    const askedAt = Date.now();
    const segment: Segment = {
      persona: "audio",
      language: p.lang,
      favourite_player: players.find((x) => x.id === p.favPlayer)?.name ?? null,
      favourite_club: clubName(p.favClub),
    };
    analyseMoment({
      data: {
        match_id: matchId,
        moment_id: `${gen}:${e.id}`,
        minute: e.minute,
        event: {
          ...e,
          player: e.player.name,
          target: e.target?.name,
          where: where(e.team, e.x, e.y),
        },
        score: state.score,
        stats: computeStats(state.events),
        teams: { home: teams.home, away: teams.away },
        segments: [segment],
        fallback_text: keyMomentLine(e, state.score, teams),
      },
    })
      .then((r) => {
        if (!r.ok) return;
        const n = r.data.narrations[0];
        if (!n || n.verification.status === "fallback") return;
        const stale = Date.now() - askedAt > STALE_MS;
        const goalSince = !isGoal && lastGoalAt.current > askedAt;
        if (!stale && !goalSince) say(n.text, "normal", "ai");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.events.length, stream, started]);

  // Status changes are always announced.
  const lastStatus = useRef(status);
  useEffect(() => {
    if (!started || lastStatus.current === status) return;
    lastStatus.current = status;
    if (status === "finished") say(`Full time. ${scoreLine(state.score, teams)}.`, "high");
    if (status === "paused") say("The match is paused.", "high");
    if (status === "live") say("Play resumes.", "normal");
  }, [status, started, say, state.score, teams]);

  // ---- questions ----
  const [thinking, setThinking] = useState(false);
  const ask = useCallback(
    async (question: string) => {
      const p = prefsRef.current;
      say(question, "high", "you");
      setThinking(true);
      const r = await askAboutMatch(question, {
        events: state.events,
        score: state.score,
        minute,
        matchId,
        gen,
        info,
        lang: p.lang,
        persona: "audio",
        favClub: p.favClub,
        favPlayer: p.favPlayer,
      });
      setThinking(false);
      say(r.answer, "high", "answer");
    },
    [say, state.events, state.score, minute, matchId, gen, info],
  );

  const repeatScore = useCallback(
    () => say(`It's ${scoreLine(state.score, teams)}, minute ${minute}.`, "high", "answer"),
    [say, state.score, minute, teams],
  );
  const repeatWhere = useCallback(() => {
    const last = state.events[state.events.length - 1];
    say(
      last
        ? `${teams[last.team].name} have it ${where(last.team, last.toX, last.toY)}.`
        : "The match hasn't started yet.",
      "high",
      "answer",
    );
  }, [say, state.events, teams]);

  return {
    started,
    start,
    stop,
    log,
    ask,
    thinking,
    repeatScore,
    repeatWhere,
    minute,
    voiceUnavailable,
  };
}
