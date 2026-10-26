import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Headphones, Play } from "iconsax-reactjs";
import { ClubBadge } from "@/components/dashboard/avatars";
import { CLUBS } from "@/match/engine";
import { followedClubs, useFollow, type Follow } from "@/match/follow";
import { useMatchday, type LiveMatch, type UpcomingMatch } from "@/match/use-matchday";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sokait | Matchday" },
      {
        name: "description",
        content:
          "Live synthetic football with explainable AI commentary: pick a match, follow your teams, listen or watch.",
      },
    ],
  }),
  component: Matchday,
});

const club = (id: string) => CLUBS.find((c) => c.id === id)!;
const GOAL_FLASH_MS = 10000;

function Matchday() {
  const { live, upcoming, goalAt } = useMatchday();
  const { follow, update } = useFollow();
  const followed = followedClubs(follow);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
        <header className="flex items-center gap-2.5">
          <span className="inline-block h-6 w-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--pp-primary)]" />
          <span className="font-display text-lg font-semibold">Sokait</span>
          <span className="ml-2 text-xs text-muted-foreground">Synthetic League · Matchday</span>
        </header>

        <section className="mt-8">
          <h1 className="font-display text-3xl font-semibold md:text-4xl">Pick a match</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every key moment explained by a team of AI agents, checked against the match data, in
            your language. Watch it, or listen with headphones.
          </p>
        </section>

        <section aria-labelledby="live-h" className="mt-8">
          <h2 id="live-h" className="mb-3 flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-live animate-live" />
            Live now
          </h2>
          {live.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading the matchday…</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-3">
              {live.map((m) => (
                <LiveCard
                  key={m.id}
                  m={m}
                  followed={followed}
                  goal={now - (goalAt[m.id] ?? 0) < GOAL_FLASH_MS}
                  next={upcoming.find((u) => u.channel === live.indexOf(m))}
                  now={now}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section aria-labelledby="up-h">
            <h2 id="up-h" className="mb-3 text-sm font-medium">
              Coming up
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl glass-strong">
              {upcoming.map((u) => (
                <UpcomingRow key={u.id} u={u} followed={followed} now={now} />
              ))}
            </ul>
          </section>

          <YourTeams follow={follow} update={update} />
        </div>

        <p className="mt-10 text-center text-[11px] text-muted-foreground">
          All clubs, players and events are synthetic. Player portraits are AI-generated.
        </p>
      </div>
    </div>
  );
}

function Teams({ home, away, followed }: { home: string; away: string; followed: Set<string> }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex -space-x-2">
        <ClubBadge team="home" clubId={home} size={32} />
        <ClubBadge team="away" clubId={away} size={32} />
      </span>
      <span className="min-w-0 leading-tight">
        {[home, away].map((id) => (
          <span key={id} className="flex items-center gap-1 truncate text-sm">
            {club(id).name}
            {followed.has(id) && (
              <span aria-label="followed" className="text-live">
                ♥
              </span>
            )}
          </span>
        ))}
      </span>
    </span>
  );
}

function LiveCard({
  m,
  followed,
  goal,
  next,
  now,
}: {
  m: LiveMatch;
  followed: Set<string>;
  goal: boolean;
  next: UpcomingMatch | undefined;
  now: number;
}) {
  const finished = m.status === "finished";
  return (
    <li
      key={goal ? "goal" : "calm"}
      className={`rounded-2xl border p-4 glass-strong ${goal ? "border-win animate-goal" : "border-transparent"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <Teams home={m.home} away={m.away} followed={followed} />
        <span className="font-display text-3xl font-semibold tabular-nums">
          {m.score.home}–{m.score.away}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        {goal ? (
          <span className="font-bold text-win">GOAL!</span>
        ) : finished ? (
          <span>
            Full time
            {next && ` · next here in ${until(next.kickoffAt, now)}`}
          </span>
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
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          to="/watch"
          search={{ match: m.id }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Play variant="Bold" className="h-4 w-4" />
          Watch
        </Link>
        <Link
          to="/watch"
          search={{ match: m.id, listen: 1 }}
          aria-label={`Listen to ${club(m.home).name} against ${club(m.away).name}`}
          className="grid w-11 place-items-center rounded-xl bg-secondary"
          title="Listen (audio mode)"
        >
          <Headphones className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

function until(at: number, now: number): string {
  const min = Math.ceil((at - now) / 60000);
  return min <= 1 ? "under a minute" : `~${min} min`;
}

function UpcomingRow({
  u,
  followed,
  now,
}: {
  u: UpcomingMatch;
  followed: Set<string>;
  now: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <Teams home={u.home} away={u.away} followed={followed} />
      <span className="shrink-0 text-xs text-muted-foreground">
        Kick-off in {until(u.kickoffAt, now)}
      </span>
    </li>
  );
}

function YourTeams({
  follow,
  update,
}: {
  follow: Follow;
  update: (patch: Partial<Follow>) => void;
}) {
  const toggle = (id: string) =>
    update({
      also: follow.also.includes(id) ? follow.also.filter((c) => c !== id) : [...follow.also, id],
    });
  return (
    <section aria-labelledby="teams-h" className="rounded-2xl glass-strong p-5">
      <h2 id="teams-h" className="text-sm font-medium">
        Your teams
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        While you watch, live matches of the clubs you follow stack up in the corner of the pitch,
        and goals there pop up so you can switch.
      </p>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs text-muted-foreground">Your club</legend>
        <div className="flex flex-wrap gap-2">
          {CLUBS.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${follow.favClub === c.id ? "border-live bg-live/10" : "border-border"}`}
            >
              <input
                type="radio"
                name="fav-club"
                className="sr-only"
                checked={follow.favClub === c.id}
                onChange={() => update({ favClub: c.id })}
              />
              <ClubBadge team="home" clubId={c.id} size={20} />
              {c.short}
              {follow.favClub === c.id && <span className="text-live">♥</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs text-muted-foreground">Also keep track of</legend>
        <div className="flex flex-wrap gap-2">
          {CLUBS.filter((c) => c.id !== follow.favClub).map((c) => {
            const on = follow.also.includes(c.id);
            return (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary/10" : "border-border text-muted-foreground"}`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => toggle(c.id)}
                />
                <ClubBadge team="away" clubId={c.id} size={20} />
                {c.name}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
