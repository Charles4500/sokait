import { useCallback, useEffect, useState } from "react";
import type { MatchState } from "@/match/engine";
import type { HubMessage, MatchStatus } from "@/match/hub";

export type MatchView = Pick<MatchState, "clock" | "score" | "events">;
type EventMsg = Extract<HubMessage, { type: "event" }>;

const EMPTY: MatchView = { clock: 0, score: { home: 0, away: 0 }, events: [] };

function append(v: MatchView, msgs: EventMsg[]): MatchView {
  const lastId = v.events[v.events.length - 1]?.id ?? 0;
  const fresh = msgs.filter((m) => m.seq > lastId);
  const last = fresh[fresh.length - 1];
  if (!last) return v;
  return {
    clock: last.clock,
    score: last.score,
    events: [...v.events, ...fresh.map((m) => m.event)].slice(-400),
  };
}

/**
 * Follows the server's live match over SSE (see /api/match/stream).
 * `?seed=N` in the page URL follows a private, reproducible replay instead.
 * `gen` changes whenever the match restarts.
 */
export function useMatchStream() {
  const [view, setView] = useState<MatchView>(EMPTY);
  const [status, setStatus] = useState<MatchStatus>("live");
  const [gen, setGen] = useState(0);
  const [connected, setConnected] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const [matchId, setMatchId] = useState("main");

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("seed");
    setSeed(s);
    const es = new EventSource(`/api/match/stream${s ? `?seed=${encodeURIComponent(s)}` : ""}`);
    let currentGen = 0;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource retries on its own
    es.addEventListener("status", (ev) => {
      const m = JSON.parse((ev as MessageEvent).data) as Extract<HubMessage, { type: "status" }>;
      if (m.gen !== currentGen) {
        currentGen = m.gen;
        setGen(m.gen);
        setView(EMPTY);
      }
      setStatus(m.status);
      setMatchId(m.matchId);
    });
    es.addEventListener("snapshot", (ev) => {
      const m = JSON.parse((ev as MessageEvent).data) as { gen: number; events: EventMsg[] };
      if (m.gen === currentGen) setView((v) => append(v, m.events));
    });
    es.addEventListener("event", (ev) => {
      const m = JSON.parse((ev as MessageEvent).data) as EventMsg;
      if (m.gen === currentGen) setView((v) => append(v, [m]));
    });
    return () => es.close();
  }, []);

  const control = useCallback(
    async (action: "pause" | "resume" | "restart") => {
      const body = seed === null ? { action } : { action, replaySeed: Number(seed) };
      const r = await fetch("/api/match/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Control failed");
    },
    [seed],
  );

  return { state: view, status, gen, matchId, connected, control, isReplay: seed !== null };
}
