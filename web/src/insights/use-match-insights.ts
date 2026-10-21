import { useEffect, useMemo, useRef, useState } from "react";
import {
  TEAMS,
  PLAYERS,
  computeStats,
  playerStats,
  mvp,
  explain,
  playerTag,
  type MatchEvent,
  type Player,
} from "@/match/engine";
import type { MatchView } from "@/match/use-match-stream";
import {
  analyseMoment,
  writeRecap,
  type Overlay as AgentOverlay,
  type Persona,
  type Segment,
  type Verification,
} from "@/insights/agents.functions";
import { speak } from "@/insights/speech";
import type { Dual, FeedItem, OnAir, Prefs } from "@/components/dashboard/types";

const AI_COOLDOWN_MS = 6000;

/**
 * Stages (b)–(e) of the pipeline on the client: interpret the streamed match, pick key
 * moments, show the deterministic explanation at once, and upgrade it with verified
 * agent narration for every segment on screen.
 */
export function useMatchInsights(state: MatchView, gen: number, matchId: string, prefs: Prefs) {
  const { mode, lang, favClub, favPlayer, compare } = prefs;

  // (b) INTERPRET
  const stats = useMemo(() => computeStats(state.events), [state.events]);
  const star = useMemo(() => mvp(state.events), [state.events]);
  const starStats = useMemo(
    () => playerStats(state.events, star.player.id),
    [state.events, star.player.id],
  );
  const fav = PLAYERS.find((p) => p.id === favPlayer)!;
  const favStats = useMemo(() => playerStats(state.events, favPlayer), [state.events, favPlayer]);
  const minute = Math.min(90, Math.floor(state.clock / 60));

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [onAir, setOnAir] = useState<OnAir | null>(null);
  const [tag, setTag] = useState<{ id: number; text: string; player: Player } | null>(null);
  const [dual, setDual] = useState<Dual | null>(null);
  const [lastAgents, setLastAgents] = useState<AgentOverlay | null>(null);
  const [recap, setRecap] = useState("");
  const [recapStatus, setRecapStatus] = useState<Verification | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);

  const voiceRef = useRef(prefs.voice);
  useEffect(() => {
    voiceRef.current = prefs.voice;
  }, [prefs.voice]);

  const segmentFor = (persona: Persona): Segment => ({
    persona,
    language: lang,
    favourite_player: persona === "player" ? fav.name : null,
    favourite_club: TEAMS[favClub].name,
  });

  // (c) EXPLAIN + (d) RENDER + (e) PERSONALISE
  const isKeyMoment = (e: MatchEvent) =>
    e.importance >= 0.6 || (mode === "player" && e.player.id === favPlayer && e.importance >= 0.3);
  const seenLen = useRef(0);
  const seenGen = useRef(gen);
  const lastAi = useRef(0);
  // Verified AI text by event id, so jumping around the timeline never loses it.
  const aiById = useRef(new Map<number, Pick<FeedItem, "ai" | "verification">>());

  useEffect(() => {
    if (seenGen.current !== gen) {
      // Match restarted: drop everything derived from the old one.
      seenGen.current = gen;
      setFeed([]);
      setOnAir(null);
      setRecap("");
      setRecapStatus(null);
      setLastAgents(null);
      setDual(null);
      aiById.current.clear();
    }
    const added = state.events.length - seenLen.current;
    seenLen.current = state.events.length;
    if (added === 0) return;
    if (added !== 1) {
      // A jump: joined mid-match, reconnected, or the viewer moved along the timeline.
      // Rebuild the key moments up to this point, keeping AI text we already have.
      const rebuilt = state.events
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => isKeyMoment(e))
        .map(({ e, i }) => ({
          e,
          why: explain(e, computeStats(state.events.slice(0, i + 1))),
          ...aiById.current.get(e.id),
        }))
        .reverse()
        .slice(0, 30);
      setFeed(rebuilt);
      setOnAir(null);
      setTag(null);
      return;
    }
    const e = state.events[state.events.length - 1];
    if (!e) return;
    const t = playerTag(state.events, e);
    if (t) setTag({ id: e.id, text: t, player: e.player });
    if (!isKeyMoment(e)) return;

    const why = explain(e, stats);
    const title = `${e.minute}' ${e.label}`;
    setFeed((f) => [{ e, why }, ...f].slice(0, 30));
    setOnAir({
      title,
      text: why,
      ai: false,
      team: e.team,
      player: e.player,
      minute: e.minute,
      label: e.label,
      durationMs: e.type === "goal" ? 8000 : 4500,
    });
    if (Date.now() - lastAi.current < AI_COOLDOWN_MS) return;
    lastAi.current = Date.now();

    // One agent call per moment covers every segment on screen: the viewer's own view
    // plus both Analyst vs Fan columns when compare is on.
    const segments: Segment[] = [segmentFor(mode)];
    if (compare)
      (["analyst", "casual"] as const)
        .filter((p) => p !== mode)
        .forEach((p) => segments.push(segmentFor(p)));
    if (compare) setDual({ title, analyst: "Thinking…", casual: "Thinking…" });

    analyseMoment({
      data: {
        match_id: matchId,
        moment_id: `${gen}:${e.id}`,
        minute: e.minute,
        event: { ...e, player: e.player.name, target: e.target?.name },
        score: state.score,
        stats,
        teams: { home: TEAMS.home, away: TEAMS.away },
        segments,
        fallback_text: why,
      },
    })
      .then((r) => {
        if (!r.ok) {
          if (compare)
            setDual((d) => (d?.title === title ? { ...d, analyst: why, casual: why } : d));
          return;
        }
        const ov = r.data;
        const textFor = (p: Persona) =>
          ov.narrations.find((n) => n.segment.persona === p)?.text ?? why;
        const mine = ov.narrations[0]!;
        setLastAgents(ov);
        setOnAir((o) =>
          o?.title === title
            ? {
                ...o,
                text: mine.text,
                ai: mine.verification.status !== "fallback",
                verification: mine.verification,
              }
            : o,
        );
        if (compare)
          setDual((d) =>
            d?.title === title
              ? { ...d, analyst: textFor("analyst"), casual: textFor("casual") }
              : d,
          );
        if (mine.verification.status === "fallback") return;
        if (voiceRef.current) speak(mine.text, lang).catch(() => {});
        aiById.current.set(e.id, { ai: mine.text, verification: mine.verification });
        setFeed((f) =>
          f.map((x) =>
            x.e.id === e.id ? { ...x, ai: mine.text, verification: mine.verification } : x,
          ),
        );
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.events.length]);

  const runRecap = async () => {
    setRecapLoading(true);
    const r = await writeRecap({
      data: {
        match_id: matchId,
        moment_id: `${gen}:${state.events[state.events.length - 1]?.id ?? 0}`,
        minute,
        score: state.score,
        stats,
        teams: { home: TEAMS.home, away: TEAMS.away },
        segment: segmentFor(mode),
        key_moments: feed.slice(0, 12).map((f) => `${f.e.minute}' ${f.e.label}`),
        mvp: star.player.name,
      },
    }).catch(() => ({ ok: false as const, error: "Agent service unavailable" }));
    if (r.ok) {
      setRecap([r.data.headline, "", ...r.data.bullets.map((b) => `• ${b}`)].join("\n"));
      setRecapStatus(r.data.verification);
      if (voiceRef.current)
        speak(`${r.data.headline}. ${r.data.bullets.join(" ")}`, lang).catch(() => {});
    } else {
      setRecap(`⚠ ${r.error}`);
      setRecapStatus(null);
    }
    setRecapLoading(false);
  };

  return {
    stats,
    star,
    starStats,
    fav,
    favStats,
    minute,
    feed,
    onAir,
    tag,
    dual,
    lastAgents,
    recap: { text: recap, status: recapStatus, loading: recapLoading, run: runRecap },
  };
}
