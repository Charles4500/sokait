import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cup,
  Headphone,
  Location,
  MagicStar,
  Microphone2,
  Radio,
  StopCircle,
} from "iconsax-reactjs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LANGS, type Prefs } from "@/components/dashboard/types";
import { VOICE_HELP } from "@/insights/speech";
import { CLUBS, type TeamId } from "@/match/engine";
import { favSide, useFixture } from "@/match/fixture-context";
import type { MatchStatus } from "@/match/hub";
import type { Detail, ListenPrefs, Spoken, useListen } from "./use-listen";
import { listenOnce, listeningSupported } from "./voice";

export type ListenSettings = Pick<ListenPrefs, "detail" | "rate" | "ballSound" | "screenReader">;

const DETAIL: { id: Detail; label: string; hint: string }[] = [
  { id: "goals", label: "Goals only", hint: "Quiet: just goals and the final whistle" },
  { id: "key", label: "Key moments", hint: "Chances, goals and big moments explained" },
  { id: "every", label: "Every touch", hint: "Short call for every pass and tackle" },
];

/** PitchPulse Listen: follow the match by sound, in a sheet beside the dashboard.
 *  Listening carries on when the sheet is closed, like a radio. */
export function ListenSheet({
  listen,
  score,
  status,
  prefs,
  update,
  settings,
  updateSettings,
}: {
  listen: ReturnType<typeof useListen>;
  score: Record<TeamId, number>;
  status: MatchStatus;
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  settings: ListenSettings;
  updateSettings: (patch: Partial<ListenSettings>) => void;
}) {
  const info = useFixture();
  const { teams } = info;
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const [typed, setTyped] = useState("");
  const [canSpeak, setCanSpeak] = useState(false);
  useEffect(() => setCanSpeak(listeningSupported()), []);

  const askByVoice = useCallback(async () => {
    if (listening) return stopRef.current?.();
    const { result, stop } = listenOnce(prefs.lang);
    stopRef.current = stop;
    setListening(true);
    try {
      const heard = (await result).trim();
      if (heard) await listen.ask(heard);
    } catch {
      /* microphone blocked or unsupported: typing still works */
    } finally {
      setListening(false);
    }
  }, [listening, prefs.lang, listen]);

  // Keyboard shortcuts while listening: A ask, S score, W where, B ball sound.
  useEffect(() => {
    if (!listen.started) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "a" && canSpeak) void askByVoice();
      if (k === "s") listen.repeatScore();
      if (k === "w") listen.repeatWhere();
      if (k === "b") updateSettings({ ballSound: !settings.ballSound });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listen, canSpeak, askByVoice, settings.ballSound, updateSettings]);

  const latest = listen.log[0];
  const statusText =
    status === "finished" ? "Full time" : status === "paused" ? "Paused" : `${listen.minute}'`;

  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger className="relative flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-secondary data-[state=open]:bg-secondary">
            <Headphone variant="Bulk" className="h-4 w-4" aria-hidden />
            Listen
            {listen.started && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-live animate-live">
                <span className="sr-only">(on)</span>
              </span>
            )}
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Follow the match by sound: built for blind and low-vision fans
        </TooltipContent>
      </Tooltip>

      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border p-5 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <Headphone variant="Bulk" className="h-5 w-5 text-primary" aria-hidden />
            PitchPulse Listen
          </SheetTitle>
          <SheetDescription>
            Live football through sound. Put on headphones: the ball moves around you, and AI
            commentary tells you what matters.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          {!settings.screenReader && listen.voiceUnavailable && (
            <p role="alert" className="rounded-xl bg-live/15 p-3 text-sm">
              {VOICE_HELP}
            </p>
          )}

          <section
            aria-label="Score"
            className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3"
          >
            <span className="font-display text-2xl font-semibold">
              {teams.home.short} {score.home} – {score.away} {teams.away.short}
            </span>
            <span className="text-sm text-muted-foreground">{statusText}</span>
          </section>

          {!listen.started ? (
            <>
              <button
                onClick={() => void listen.start()}
                className="w-full rounded-xl bg-primary px-6 py-4 font-display text-lg text-primary-foreground shadow-cta focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                Start listening
              </button>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>
                  {teams[favSide(info, prefs.favClub) ?? "home"].name} always attack to your right.
                </li>
                <li>A soft tick follows the ball and speeds up near a goal.</li>
                <li>Rising notes: your team wins the ball. Falling: the opponent.</li>
                <li>A click is a pass, a whoosh a shot, a fanfare a goal.</li>
                <li>Ask out loud: “who is winning?”, “how is Mensah doing?”</li>
              </ul>
            </>
          ) : (
            <section aria-label="Controls" className="grid grid-cols-2 gap-2">
              {canSpeak && (
                <button
                  onClick={() => void askByVoice()}
                  aria-pressed={listening}
                  className={`col-span-2 flex items-center justify-center gap-2 rounded-xl px-4 py-4 font-display text-lg focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-foreground ${listening ? "bg-live text-white" : "bg-primary text-primary-foreground"}`}
                >
                  <Microphone2 className="h-5 w-5" aria-hidden />
                  {listening
                    ? "Listening… tap to stop"
                    : listen.thinking
                      ? "Thinking…"
                      : "Ask a question"}
                </button>
              )}
              <ControlButton
                onClick={listen.repeatScore}
                icon={<Cup variant="Bulk" className="h-4 w-4" />}
              >
                Score
              </ControlButton>
              <ControlButton onClick={listen.repeatWhere} icon={<Location className="h-4 w-4" />}>
                Where's the ball
              </ControlButton>
              <form
                className="col-span-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typed.trim()) void listen.ask(typed.trim());
                  setTyped("");
                }}
              >
                <label htmlFor="listen-typed" className="sr-only">
                  Type a question
                </label>
                <input
                  id="listen-typed"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Or type a question"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm"
                />
                <button className="rounded-xl bg-secondary px-4 text-sm">Ask</button>
              </form>
              <ControlButton
                onClick={listen.stop}
                icon={<StopCircle className="h-4 w-4" />}
                className="col-span-2"
              >
                Stop listening
              </ControlButton>
              <p className="col-span-2 text-xs text-muted-foreground">
                Keys: {canSpeak && "A ask, "}S score, W where, B ball sound.
              </p>
            </section>
          )}

          <ListenSettingsPanel
            prefs={prefs}
            update={update}
            settings={settings}
            updateSettings={updateSettings}
          />

          <section aria-labelledby="listen-said">
            <h3 id="listen-said" className="mb-3 font-display text-sm">
              Commentary
            </h3>
            {listen.log.length === 0 ? (
              <p className="text-sm text-muted-foreground">Everything spoken appears here.</p>
            ) : (
              <MessageGroup className="gap-3">
                {listen.log.map((s) => (
                  <SpokenMessage key={s.id} s={s} />
                ))}
              </MessageGroup>
            )}
          </section>
        </div>

        {/* Screen-reader mode: the user's own screen reader speaks, nothing else does. */}
        <div aria-live="assertive" className="sr-only">
          {settings.screenReader && latest ? latest.text : ""}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ControlButton({
  onClick,
  icon,
  children,
  className = "",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-3 text-sm focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-foreground ${className}`}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}

const SPEAKER: Record<Spoken["kind"], { name: string; icon: React.ReactNode }> = {
  match: { name: "Match", icon: <Radio className="h-3.5 w-3.5" /> },
  ai: {
    name: "AI commentary",
    icon: <MagicStar variant="Bulk" className="h-3.5 w-3.5 text-primary" />,
  },
  answer: {
    name: "Match assistant",
    icon: <MagicStar variant="Bulk" className="h-3.5 w-3.5 text-primary" />,
  },
  you: { name: "You", icon: null },
};

function SpokenMessage({ s }: { s: Spoken }) {
  const mine = s.kind === "you";
  const who = SPEAKER[s.kind];
  return (
    <Message align={mine ? "end" : "start"}>
      {!mine && (
        <MessageAvatar className="size-7 self-start group-has-data-[slot=message-footer]/message:translate-y-0">
          {who.icon}
        </MessageAvatar>
      )}
      <MessageContent className="gap-1">
        <MessageHeader className="px-1">{who.name}</MessageHeader>
        <div
          className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : s.kind === "match" ? "bg-muted/60" : "bg-secondary"}`}
        >
          {s.text}
        </div>
      </MessageContent>
    </Message>
  );
}

function ListenSettingsPanel({
  prefs,
  update,
  settings,
  updateSettings,
}: {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  settings: ListenSettings;
  updateSettings: (patch: Partial<ListenSettings>) => void;
}) {
  const { teams, players } = useFixture();
  const field = "w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm";
  return (
    <details className="rounded-xl bg-muted/30 p-4">
      <summary className="cursor-pointer font-display text-sm">Personalise</summary>
      <div className="mt-4 space-y-4 text-sm">
        <label className="block space-y-1">
          <span>Language</span>
          <select
            className={field}
            value={prefs.lang}
            onChange={(e) => update({ lang: e.target.value })}
          >
            {LANGS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span>Favourite club</span>
          <select
            className={field}
            value={prefs.favClub}
            onChange={(e) => update({ favClub: e.target.value })}
          >
            {CLUBS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span>Favourite player</span>
          <select
            className={field}
            value={prefs.favPlayer}
            onChange={(e) => update({ favPlayer: e.target.value })}
          >
            {players
              .filter((p) => p.pos !== "GK")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({teams[p.team].short})
                </option>
              ))}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend className="mb-1">Level of detail</legend>
          {DETAIL.map((d) => (
            <label key={d.id} className="flex items-start gap-3 rounded-lg bg-muted/40 p-2.5">
              <input
                type="radio"
                name="listen-detail"
                className="mt-0.5 h-4 w-4"
                checked={settings.detail === d.id}
                onChange={() => updateSettings({ detail: d.id })}
              />
              <span>
                {d.label}
                <span className="block text-xs text-muted-foreground">{d.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1">
          <span>Speaking speed: {settings.rate.toFixed(1)}×</span>
          <input
            type="range"
            min={0.7}
            max={1.8}
            step={0.1}
            value={settings.rate}
            onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={settings.ballSound}
            onChange={(e) => updateSettings({ ballSound: e.target.checked })}
          />
          Ball sound
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={settings.screenReader}
            onChange={(e) => updateSettings({ screenReader: e.target.checked })}
          />
          <span>
            Use my screen reader
            <span className="block text-xs text-muted-foreground">
              Commentary goes to your screen reader instead of the built-in voice.
            </span>
          </span>
        </label>
      </div>
    </details>
  );
}
