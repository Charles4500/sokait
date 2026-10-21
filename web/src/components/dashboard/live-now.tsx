import { useEffect, useRef, useState } from "react";
import { ArrowDown2, ArrowUp2 } from "iconsax-reactjs";
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

/** Every match playing right now, stacked in the corner of the pitch like a live
 *  playlist. A goal in a match you aren't watching makes its row pop; click to switch. */
export function LivePlaylist({
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
  const [open, setOpen] = useState(true);
  const [, rerender] = useState(0);
  const last = useRef<Record<string, number>>({});

  useEffect(() => {
    let live = true;
    const load = async () => {
      const res = await fetch("/api/match/live").catch(() => null);
      if (!res?.ok || !live) return;
      const list = (await res.json()) as LiveMatch[];
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
      rerender((n) => n + 1); // let goal highlights expire
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (!matches.length) return null;
  const goals = matches.filter(
    (m) => m.id !== current && Date.now() - (goalAt[m.id] ?? 0) < GOAL_FLASH_MS,
  ).length;

  return (
    <nav aria-label="Live now" className="w-52 overflow-hidden rounded-xl glass shadow-lg">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-live animate-live" />
        Live now
        <span className="text-muted-foreground">· {matches.length}</span>
        {!open && goals > 0 && (
          <span className="rounded bg-win px-1.5 text-[10px] font-bold text-background animate-goal">
            GOAL
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ArrowDown2 className="h-3.5 w-3.5" /> : <ArrowUp2 className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && (
        <ul className="space-y-1 p-1.5 pt-0">
          {matches.map((m) => {
            const watching = m.id === current;
            const mine = m.home === favClub || m.away === favClub;
            const goal = !watching && Date.now() - (goalAt[m.id] ?? 0) < GOAL_FLASH_MS;
            return (
              <li key={`${m.id}-${goal ? goalAt[m.id] : "calm"}`}>
                <button
                  onClick={() => onSelect(m.id)}
                  aria-current={watching}
                  title={watching ? "Watching" : "Switch to this match (N)"}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors ${watching ? "border-primary bg-primary/15" : goal ? "border-win bg-win/15 animate-goal" : "border-transparent bg-background/40 hover:bg-secondary"}`}
                >
                  <span className="flex -space-x-1.5">
                    <ClubBadge team="home" clubId={m.home} size={20} />
                    <ClubBadge team="away" clubId={m.away} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 font-display text-xs">
                      <span className="truncate">
                        {club(m.home)?.short} {m.score.home}–{m.score.away} {club(m.away)?.short}
                      </span>
                      {mine && (
                        <span aria-label="your club" className="text-live">
                          ♥
                        </span>
                      )}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {goal ? (
                        <span className="font-bold text-win">GOAL · tap to watch</span>
                      ) : watching ? (
                        "Watching"
                      ) : m.status === "finished" ? (
                        "Full time"
                      ) : (
                        `${m.minute}'`
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
