import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AgentTrace } from "@/components/dashboard/agent-trace";
import { ComparePanel } from "@/components/dashboard/compare-panel";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LiveCommentary } from "@/components/dashboard/live-commentary";
import { MatchCentre } from "@/components/dashboard/match-centre";
import { MatchStats } from "@/components/dashboard/match-stats";
import { MatchTitleBar } from "@/components/dashboard/match-title-bar";
import { MatchVideo } from "@/components/dashboard/match-video";
import { RecapPanel } from "@/components/dashboard/recap-panel";
import type { Prefs } from "@/components/dashboard/types";
import { WinProbability } from "@/components/dashboard/win-probability";
import { PLAYERS } from "@/match/engine";
import { useMatchInsights } from "@/insights/use-match-insights";
import { useMatchStream } from "@/match/use-match-stream";
import { usePlayback } from "@/match/use-playback";
import { MatchTimeline } from "@/components/dashboard/match-timeline";
import { ListenSheet, type ListenSettings } from "@/listen/listen-sheet";
import { useListen } from "@/listen/use-listen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PitchPulse | Live Match Insights" },
      {
        name: "description",
        content:
          "Ingest, interpret, explain, render and personalise synthetic football events in real time.",
      },
      { property: "og:title", content: "PitchPulse | Live Match Insights" },
      {
        property: "og:description",
        content:
          "Explainable, personalised, multi-language match intelligence for studio and streaming.",
      },
    ],
  }),
  component: Dashboard,
});

const DEFAULT_LISTEN: ListenSettings = {
  detail: "key",
  rate: 1.1,
  ballSound: true,
  screenReader: false,
};
const LISTEN_KEY = "pitchpulse.listen.settings";

const DEFAULT_PREFS: Prefs = {
  mode: "casual",
  lang: "English",
  favClub: "home",
  favPlayer: PLAYERS[4]!.id,
  voice: false,
  compare: false,
};

function Dashboard() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  // (a) INGEST: the shared synthetic match, streamed from the server.
  const { state: live, status, gen, matchId, control } = useMatchStream();
  // Listen (audio mode) always follows live, whatever the timeline shows.
  const [listenSettings, setListenSettings] = useState<ListenSettings>(DEFAULT_LISTEN);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LISTEN_KEY);
      if (saved) setListenSettings({ ...DEFAULT_LISTEN, ...JSON.parse(saved) });
    } catch {
      /* storage unavailable: defaults for this visit */
    }
  }, []);
  const updateListen = useCallback((patch: Partial<ListenSettings>) => {
    setListenSettings((s) => {
      const next = { ...s, ...patch };
      try {
        localStorage.setItem(LISTEN_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  const listen = useListen(live, status, gen, matchId, {
    ...listenSettings,
    lang: prefs.lang,
    favClub: prefs.favClub,
    favPlayer: prefs.favPlayer,
  });

  // What this viewer is watching: live, or a replay from earlier on the timeline.
  const playback = usePlayback(live, gen);
  const state = playback.view;
  // (b)–(e) INTERPRET, EXPLAIN, RENDER, PERSONALISE.
  const m = useMatchInsights(state, gen, matchId, prefs);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-360 overflow-hidden glass">
        <DashboardHeader
          prefs={prefs}
          update={update}
          listen={
            <ListenSheet
              listen={listen}
              score={live.score}
              status={status}
              prefs={prefs}
              update={update}
              settings={listenSettings}
              updateSettings={updateListen}
            />
          }
        />

        <div className="relative grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* PRIMARY: the match and what it means */}
          <main className="min-w-0 space-y-4">
            <MatchVideo
              events={state.events}
              score={state.score}
              minute={m.minute}
              status={status}
              prefs={prefs}
              fav={m.fav}
              favStats={m.favStats}
              tag={m.tag}
              onAir={m.onAir}
            />
            <MatchTimeline
              events={live.events}
              liveClock={playback.liveClock}
              viewClock={state.clock}
              isLive={playback.isLive}
              playing={playback.playing}
              finished={status === "finished"}
              onSeek={playback.seek}
              onToggle={playback.toggle}
              onGoLive={playback.goLive}
            />
            <MatchTitleBar
              isLive={playback.isLive}
              status={status}
              minute={m.minute}
              prefs={prefs}
              fav={m.fav}
              control={control}
            />
            <MatchStats stats={m.stats} star={m.star} />
            {prefs.compare && <ComparePanel dual={m.dual} stats={m.stats} />}
            <div className="grid gap-4 md:grid-cols-2">
              <RecapPanel recap={m.recap} prefs={prefs} canRun={state.events.length > 0} />
              <section className="rounded-2xl glass-strong p-4">
                <h2 className="mb-3 text-sm font-medium">How the last insight was made</h2>
                <AgentTrace overlay={m.lastAgents} />
              </section>
            </div>
          </main>

          {/* SIDEBAR: live commentary beside the video, like a live chat */}
          <aside className="space-y-4 lg:sticky lg:top-4">
            <LiveCommentary feed={m.feed} />
            <WinProbability winProb={m.stats.winProb} />
            <MatchCentre events={state.events} stats={m.stats} />
          </aside>
        </div>
      </div>
    </div>
  );
}
