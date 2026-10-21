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
const CARD_H = 60; // px
const PEEK = 9; // px of each card visible behind the front one
const GAP = 6; // px between cards when fanned out

/**
 * Matches playing right now as a stacked deck in the corner of the pitch. The front card
 * is the most urgent (a goal elsewhere, then other live matches); the one you're watching
 * sits at the back. Hover, focus or tap fans the deck out. A goal makes its card jump to
 * the front, glow and pop.
 */
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
  const [fanned, setFanned] = useState(false);
  const [, tick] = useState(0);
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
      tick((n) => n + 1); // let goal highlights expire
    };
    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (!matches.length) return null;

  const now = Date.now();
  const hasGoal = (m: LiveMatch) => m.id !== current && now - (goalAt[m.id] ?? 0) < GOAL_FLASH_MS;
  // Front of the deck first: goals elsewhere, then other matches (your club first), then
  // the one you're watching.
  const rank = (m: LiveMatch) =>
    m.id === current ? 3 : hasGoal(m) ? 0 : m.home === favClub || m.away === favClub ? 1 : 2;
  const deck = [...matches].sort((a, b) => rank(a) - rank(b));
  const n = deck.length;
  const height = fanned ? n * CARD_H + (n - 1) * GAP : CARD_H + (n - 1) * PEEK;

  return (
    <nav
      aria-label="Live now"
      onMouseEnter={() => setFanned(true)}
      onMouseLeave={() => setFanned(false)}
      onFocus={() => setFanned(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFanned(false);
      }}
      className="w-60"
    >
      <div className="mb-1.5 flex items-center justify-end gap-2 text-xs font-medium">
        <span className="flex items-center gap-1.5 rounded-full glass px-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-md bg-live animate-live" />
          Live now · {n}
        </span>
      </div>
      <ul className="relative transition-[height] duration-300 ease-out" style={{ height }}>
        {deck.map((m, i) => {
          const watching = m.id === current;
          const mine = m.home === favClub || m.away === favClub;
          const goal = hasGoal(m);
          // Card 0 sits at the bottom; the rest rise behind it (peek) or above it (fanned).
          const y = fanned ? -i * (CARD_H + GAP) : -i * PEEK;
          const scale = fanned ? 1 : 1 - i * 0.05;
          return (
            <li
              key={m.id}
              className="absolute inset-x-0 bottom-0 transition-[transform,opacity] duration-300 ease-out"
              style={{
                transform: `translateY(${y}px) scale(${scale})`,
                transformOrigin: "bottom center",
                zIndex: n - i,
                opacity: fanned || i === 0 ? 1 : 1 - i * 0.25,
              }}
            >
              <button
                key={goal ? goalAt[m.id] : "calm"}
                onClick={() => (fanned || i === 0 ? onSelect(m.id) : setFanned(true))}
                aria-current={watching}
                tabIndex={fanned || i === 0 ? 0 : -1}
                className={`flex w-full items-center gap-2 rounded-xl border px-2.5 text-left shadow-xl backdrop-blur-xl transition-colors ${watching ? "border-primary/70 bg-background/85" : goal ? "border-win bg-background/90 animate-goal" : "border-white/10 bg-background/85 hover:border-white/25"}`}
                style={{ height: CARD_H }}
              >
                <span className="flex -space-x-1.5">
                  <ClubBadge team="home" clubId={m.home} size={24} />
                  <ClubBadge team="away" clubId={m.away} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-display">
                    <span className="text-xs">{club(m.home)?.short}</span>
                    <span className="text-base font-semibold tabular-nums">
                      {m.score.home}–{m.score.away}
                    </span>
                    <span className="text-xs">{club(m.away)?.short}</span>
                    {mine && (
                      <span aria-label="your club" className="text-live">
                        ♥
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                    {goal ? (
                      <span className="font-bold text-win">GOAL · tap to watch</span>
                    ) : watching ? (
                      <span className="font-medium text-primary">Watching</span>
                    ) : m.status === "finished" ? (
                      "Full time"
                    ) : (
                      <>
                        <span className="tabular-nums">{m.minute}'</span>
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                          <span
                            className="block h-full rounded-full bg-live"
                            style={{ width: `${Math.min(100, (m.minute / 90) * 100)}%` }}
                          />
                        </span>
                      </>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
