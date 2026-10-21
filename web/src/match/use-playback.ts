import { useCallback, useEffect, useMemo, useState } from "react";
import type { MatchEvent, TeamId } from "./engine";
import type { MatchView } from "./use-match-stream";

/** Replay plays one event per step: a little faster than live, so you catch up. */
const REPLAY_STEP_MS = 700;

export const clockOf = (e: MatchEvent) => e.minute * 60 + e.second;

function viewAt(events: MatchEvent[], count: number): MatchView {
  const shown = events.slice(0, count);
  const score: Record<TeamId, number> = { home: 0, away: 0 };
  for (const e of shown) if (e.type === "goal") score[e.team]++;
  const last = shown[shown.length - 1];
  return { events: shown, score, clock: last ? clockOf(last) : 0 };
}

/**
 * Live-or-replay over the streamed match, like a live video's timeline. `cursor` is how
 * many events the viewer has reached; null means following live. Replay plays forward
 * and rejoins live automatically when it catches up. Only this viewer is affected.
 */
export function usePlayback(live: MatchView, stream: string) {
  const [cursor, setCursor] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const total = live.events.length;

  // A restarted or newly chosen match starts live.
  useEffect(() => {
    setCursor(null);
    setPlaying(true);
  }, [stream]);

  useEffect(() => {
    if (cursor === null || !playing) return;
    const t = setInterval(
      () => setCursor((c) => (c === null || c + 1 >= total ? null : c + 1)),
      REPLAY_STEP_MS,
    );
    return () => clearInterval(t);
  }, [cursor === null, playing, total]); // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(
    () => (cursor === null ? live : viewAt(live.events, cursor)),
    [cursor, live],
  );

  /** Jump to a match time (seconds); at or past the live edge means live. */
  const seek = useCallback(
    (clock: number) => {
      const count = live.events.filter((e) => clockOf(e) <= clock).length;
      setCursor(count >= total ? null : count);
    },
    [live.events, total],
  );

  const toggle = useCallback(() => {
    if (playing) {
      setCursor((c) => c ?? total); // pausing while live freezes the current moment
      setPlaying(false);
    } else setPlaying(true);
  }, [playing, total]);

  const goLive = useCallback(() => {
    setCursor(null);
    setPlaying(true);
  }, []);

  return {
    view,
    isLive: cursor === null,
    playing,
    liveClock: live.clock,
    behind: Math.max(0, live.clock - view.clock),
    seek,
    toggle,
    goLive,
  };
}
