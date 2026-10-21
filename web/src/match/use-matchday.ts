import { useEffect, useRef, useState } from "react";
import type { TeamId } from "./engine";
import type { MatchStatus } from "./hub";

export interface LiveMatch {
  id: string;
  home: string;
  away: string;
  score: Record<TeamId, number>;
  minute: number;
  status: MatchStatus;
}
export interface UpcomingMatch {
  id: string;
  home: string;
  away: string;
  channel: number;
  kickoffAt: number;
}

const POLL_MS = 3000;

/** Polls the matchday (live and upcoming), and notes when each live match last scored. */
export function useMatchday() {
  const [live, setLive] = useState<LiveMatch[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);
  const [goalAt, setGoalAt] = useState<Record<string, number>>({});
  const totals = useRef<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await fetch("/api/match/live").catch(() => null);
      if (!res?.ok || !active) return;
      const data = (await res.json()) as { live: LiveMatch[]; upcoming: UpcomingMatch[] };
      const now = Date.now();
      const fresh: Record<string, number> = {};
      for (const m of data.live) {
        const total = m.score.home + m.score.away;
        const before = totals.current[m.id];
        if (before !== undefined && total > before) fresh[m.id] = now;
        totals.current[m.id] = total;
      }
      if (Object.keys(fresh).length) setGoalAt((g) => ({ ...g, ...fresh }));
      setLive(data.live);
      setUpcoming(data.upcoming);
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return { live, upcoming, goalAt };
}
