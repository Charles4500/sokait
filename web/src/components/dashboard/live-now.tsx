import { useEffect, useRef, useState } from "react";
import { CLUBS, type TeamId } from "@/match/engine";
import type { MatchStatus } from "@/match/hub";
import { ClubBadge } from "./avatars";

interface LiveMatch {
  id: string;
  home: string;
  away: string;
  score: Record<TeamId, number>;
  minute: number;
  status: MatchStatus;
}

const club = (id: string) => CLUBS.find((c) => c.id === id);
const POLL_MS = 3000;
const GOAL_FLASH_MS = 10000;

/** Every match playing right now, like a live playlist: switch with a click (or N). */
export function LiveNow({
  current,
  favClub,
  onSelect,
}: {
  current: string;
  favClub: string;
  onSelect: (id: string) => void;
}) {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [goalAt, setGoalAt] = useState<Record<string, number>>({});
  const last = useRef<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await fetch("/api/match/live").catch(() => null);
      if (!res?.ok || !live) return;
      const list = (await res.json()) as LiveMatch[];
      // A goal in a match you aren't watching lights up its card for a while.
      const now = Date.now();
      const fresh: Record<string, number> = {};
      for (const m of list) {
        const total = m.score.home + m.score.away;
        const before = last.current[m.id];
        if (before !== undefined && total > before) fresh[m.id] = now;
        last.current[m.id] = total;
      }
      if (Object.keys(fresh).length) setGoalAt((g) => ({ ...g, ...fresh }));
      setMatches(list);
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (!matches.length) return null;
  return (
    <section aria-label="Live now" className="space-y-2">
      <h2 className="flex items-center gap-2 px-1 text-sm font-medium">
        <span className="h-2 w-2 rounded-full bg-live animate-live" />
        Live now
        <span className="text-xs font-normal text-muted-foreground">· N for next</span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-3">
        {matches.map((m) => {
          const watching = m.id === current;
          const mine = m.home === favClub || m.away === favClub;
          const goal = !watching && Date.now() - (goalAt[m.id] ?? 0) < GOAL_FLASH_MS;
          return (
            <li key={m.id}>
              <button
                onClick={() => onSelect(m.id)}
                aria-current={watching}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${watching ? "border-primary bg-primary/10" : goal ? "border-win bg-win/10" : "border-border bg-muted/30 hover:bg-secondary"}`}
              >
                <div className="flex -space-x-1.5">
                  <ClubBadge team="home" clubId={m.home} size={26} />
                  <ClubBadge team="away" clubId={m.away} size={26} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-display text-sm">
                    <span className="truncate">
                      {club(m.home)?.short} {m.score.home}–{m.score.away} {club(m.away)?.short}
                    </span>
                    {mine && (
                      <span aria-label="your club" className="text-live">
                        ♥
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {goal ? (
                      <span className="font-semibold text-win">GOAL · tap to watch</span>
                    ) : watching ? (
                      "Watching"
                    ) : m.status === "finished" ? (
                      "Full time"
                    ) : (
                      `${m.minute}'`
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
