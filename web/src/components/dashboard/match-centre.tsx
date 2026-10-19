import { useState } from "react";
import { PLAYERS, TEAMS, type MatchEvent } from "@/match/engine";
import type { MatchStats } from "./types";

const TABS = ["Timeline", "Lineup", "Statistics", "Insights"] as const;
type Tab = (typeof TABS)[number];

export function MatchCentre({ events, stats }: { events: MatchEvent[]; stats: MatchStats }) {
  const [tab, setTab] = useState<Tab>("Insights");
  return (
    <section className="rounded-2xl glass-strong p-4">
      <h2 className="text-sm font-medium">Match centre</h2>
      <div className="mt-3 flex gap-1 rounded-full bg-muted/40 p-1 text-[11px]" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-1 ${tab === t ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-3 h-40 overflow-y-auto text-xs" role="tabpanel">
        {tab === "Timeline" && <Timeline events={events} />}
        {tab === "Lineup" && <Lineup />}
        {tab === "Statistics" && <Statistics stats={stats} />}
        {tab === "Insights" && <Insights stats={stats} />}
      </div>
    </section>
  );
}

function Timeline({ events }: { events: MatchEvent[] }) {
  return events
    .slice(-14)
    .reverse()
    .map((e) => (
      <div key={e.id} className="flex gap-2 py-0.5">
        <span className="w-7 text-muted-foreground">{e.minute}'</span>
        <span className={e.team === "home" ? "text-team-home" : "text-team-away"}>●</span>
        <span className="truncate">{e.label}</span>
      </div>
    ));
}

function Lineup() {
  return (["home", "away"] as const).map((t) => (
    <div key={t} className="mb-2">
      <div className="font-display">{TEAMS[t].name}</div>
      {PLAYERS.filter((p) => p.team === t).map((p) => (
        <div key={p.id} className="text-muted-foreground">
          #{p.num} {p.name} · {p.pos}
        </div>
      ))}
    </div>
  ));
}

function Statistics({ stats }: { stats: MatchStats }) {
  const rows: [string, number, number][] = [
    ["Possession %", stats.possession.home, stats.possession.away],
    ["xG", stats.xg.home, stats.xg.away],
    ["Shots", stats.shots.home, stats.shots.away],
    ["Pass acc %", stats.passAcc.home, stats.passAcc.away],
    ["Pressing", stats.pressure.home, stats.pressure.away],
  ];
  return rows.map(([k, a, b]) => (
    <div key={k} className="mb-2">
      <div className="flex justify-between">
        <span>{a}</span>
        <span className="text-muted-foreground">{k}</span>
        <span>{b}</span>
      </div>
      <div className="mt-1 flex h-1 overflow-hidden rounded-full bg-border">
        <div className="bg-team-home" style={{ width: `${(a / (a + b || 1)) * 100}%` }} />
        <div className="flex-1 bg-team-away" />
      </div>
    </div>
  ));
}

function Insights({ stats }: { stats: MatchStats }) {
  const harder = stats.pressure.home > stats.pressure.away ? TEAMS.home.short : TEAMS.away.short;
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-muted/50 p-2">
        <b>Momentum</b> ·{" "}
        {stats.momentum > 2
          ? `${TEAMS.home.short} dominating`
          : stats.momentum < -2
            ? `${TEAMS.away.short} dominating`
            : "balanced"}
        <div className="mt-1 h-1 rounded-full bg-border">
          <div
            className="h-1 rounded-full bg-primary transition-all"
            style={{ width: `${50 + stats.momentum * 5}%` }}
          />
        </div>
      </div>
      <div className="rounded-lg bg-muted/50 p-2">
        <b>Rhythm</b> ·{" "}
        {stats.chaos > 45
          ? "Chaotic, end-to-end — transitions decide this phase."
          : "Controlled build-up — patience over risk."}
      </div>
      <div className="rounded-lg bg-muted/50 p-2">
        <b>Pressure shift</b> · {harder} pressing harder (
        {Math.max(stats.pressure.home, stats.pressure.away)} vs{" "}
        {Math.min(stats.pressure.home, stats.pressure.away)}).
      </div>
    </div>
  );
}
