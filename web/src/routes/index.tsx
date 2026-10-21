import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { FIXTURES, fixtureById } from "@/match/engine";
import { FixtureContext, fixtureInfo } from "@/match/fixture-context";
import { LiveNow } from "@/components/dashboard/live-now";
import { useMatchInsights } from "@/insights/use-match-insights";
import { useMatchStream } from "@/match/use-match-stream";
import { usePlayback } from "@/match/use-playback";
import { MatchTimeline } from "@/components/dashboard/match-timeline";
import { ShortcutsDialog } from "@/components/dashboard/shortcuts";
import { useFlash, useShortcuts, type ShortcutAction } from "@/components/dashboard/use-shortcuts";
import { MODE_LABEL, MODES } from "@/components/dashboard/types";
import { speak } from "@/insights/speech";
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
  favClub: "thr",
  favPlayer: "thr-10",
  voice: false,
  compare: false,
};

function Dashboard() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch }));

  // Which of the matches playing right now this viewer is watching (?match= in the URL).
  const [fixtureId, setFixtureId] = useState(FIXTURES[0]!.id);
  useEffect(() => {
    setFixtureId(fixtureById(new URLSearchParams(window.location.search).get("match")).id);
  }, []);
  const switchMatch = useCallback((id: string) => {
    setFixtureId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("match", id);
    window.history.replaceState(null, "", url);
  }, []);
  const info = useMemo(() => fixtureInfo(fixtureById(fixtureId)), [fixtureId]);

  // (a) INGEST: the chosen live match, streamed from the server.
  const { state: live, status, gen, matchId, control } = useMatchStream(fixtureId);
  const stream = `${matchId}#${gen}`;
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
  const listen = useListen(
    live,
    status,
    gen,
    matchId,
    {
      ...listenSettings,
      lang: prefs.lang,
      favClub: prefs.favClub,
      favPlayer: prefs.favPlayer,
    },
    info,
  );

  // What this viewer is watching: live, or a replay from earlier on the timeline.
  const playback = usePlayback(live, stream);
  const state = playback.view;
  // (b)–(e) INTERPRET, EXPLAIN, RENDER, PERSONALISE.
  const m = useMatchInsights(state, gen, matchId, prefs, info);

  // Keyboard shortcuts, YouTube-style, with a brief flash showing what happened.
  const stageRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const { flash, show } = useFlash();
  const fmtDelta = (s: number) => `${s < 0 ? "−" : "+"}${Math.abs(s) / 60}:00`;
  const run = useCallback(
    (action: ShortcutAction) => {
      const by = (delta: number) => {
        playback.seek(Math.max(0, state.clock + delta));
        show(fmtDelta(delta));
      };
      if (action.startsWith("jump")) {
        const minute = Number(action.slice(4)) * 10;
        playback.seek(minute * 60);
        return show(`${minute}'`);
      }
      switch (action) {
        case "fullscreen":
          if (document.fullscreenElement) void document.exitFullscreen();
          else void stageRef.current?.requestFullscreen();
          return;
        case "toggle":
          playback.toggle();
          return show(playback.playing ? "❚❚ Paused" : "▶ Playing");
        case "back1":
          return by(-60);
        case "fwd1":
          return by(60);
        case "back5":
          return by(-300);
        case "fwd5":
          return by(300);
        case "start":
          playback.seek(0);
          return show("Kick-off");
        case "live":
          playback.goLive();
          return show("● LIVE");
        case "voice":
          update({ voice: !prefs.voice });
          if (!prefs.voice) void speak("Commentary on.", prefs.lang);
          return show(prefs.voice ? "AI voice off" : "AI voice on");
        case "compare":
          update({ compare: !prefs.compare });
          return show(prefs.compare ? "Compare off" : "Analyst vs Fan");
        case "mode": {
          const next = MODES[(MODES.indexOf(prefs.mode) + 1) % MODES.length]!;
          update({ mode: next });
          return show(MODE_LABEL[next]);
        }
        case "help":
          return setHelpOpen(true);
        case "nextMatch":
        case "prevMatch": {
          const i = FIXTURES.findIndex((f) => f.id === fixtureId);
          const step = action === "nextMatch" ? 1 : FIXTURES.length - 1;
          const next = FIXTURES[(i + step) % FIXTURES.length]!;
          switchMatch(next.id);
          return show(`${next.home.short} v ${next.away.short}`);
        }
      }
    },
    [playback, state.clock, prefs, show, fixtureId, switchMatch],
  );
  useShortcuts(run);

  return (
    <FixtureContext.Provider value={info}>
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
            shortcuts={<ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />}
          />

          <div className="relative grid items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            {/* PRIMARY: the match and what it means */}
            <main className="min-w-0 space-y-4">
              <div
                ref={stageRef}
                className="relative space-y-3 [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:bg-background [&:fullscreen]:p-4"
              >
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
                  onFullscreen={() => run("fullscreen")}
                />
                {flash && (
                  <div
                    key={flash.id}
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/75 px-5 py-2.5 font-display text-lg backdrop-blur animate-slide-in"
                  >
                    {flash.text}
                  </div>
                )}
              </div>
              <MatchTitleBar
                isLive={playback.isLive}
                status={status}
                minute={m.minute}
                prefs={prefs}
                fav={m.fav}
                control={control}
              />
              <LiveNow current={fixtureId} favClub={prefs.favClub} onSelect={switchMatch} />
              <MatchStats stats={m.stats} star={m.star} starStats={m.starStats} />
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
    </FixtureContext.Provider>
  );
}
