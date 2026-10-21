import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Headphones, MapPin, Mic, Square, Trophy } from "lucide-react";
import { LANGS } from "@/components/dashboard/types";
import { PLAYERS, TEAMS, type TeamId } from "@/match/engine";
import { useMatchStream } from "@/match/use-match-stream";
import { useListen, type Detail, type ListenPrefs, type Spoken } from "@/listen/use-listen";
import { listenOnce, listeningSupported } from "@/listen/voice";
import { VOICE_HELP } from "@/insights/speech";
import { useVoiceStatus } from "@/insights/use-voice-status";

export const Route = createFileRoute("/listen")({
  head: () => ({
    meta: [
      { title: "PitchPulse Listen | Live football through sound" },
      {
        name: "description",
        content:
          "Follow a live match with spatial audio and AI commentary. Built for blind and low-vision fans: a phone and headphones are all you need.",
      },
    ],
  }),
  component: ListenPage,
});

const DETAIL: { id: Detail; label: string; hint: string }[] = [
  { id: "goals", label: "Goals only", hint: "Quiet: just goals and the final whistle" },
  { id: "key", label: "Key moments", hint: "Chances, goals and big moments explained" },
  { id: "every", label: "Every touch", hint: "Short call for every pass and tackle" },
];

const DEFAULT_PREFS: ListenPrefs = {
  lang: "English",
  favClub: "home",
  favPlayer: PLAYERS[4]!.id,
  detail: "key",
  rate: 1.1,
  ballSound: true,
  screenReader: false,
};
const STORE_KEY = "pitchpulse.listen.prefs";

function loadPrefs(): ListenPrefs {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<ListenPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

function ListenPage() {
  const [prefs, setPrefs] = useState<ListenPrefs>(DEFAULT_PREFS);
  useEffect(() => setPrefs(loadPrefs()), []);
  const update = (patch: Partial<ListenPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: settings last for this visit only */
      }
      return next;
    });

  const { state, status, gen, matchId } = useMatchStream();
  const voice = useVoiceStatus(prefs.lang, !prefs.screenReader);
  const listen = useListen(state, status, gen, matchId, prefs);

  // ---- asking by voice or by typing ----
  const [listening, setListening] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const [typed, setTyped] = useState("");
  const canSpeak = typeof window !== "undefined" && listeningSupported();

  const askByVoice = useCallback(async () => {
    if (listening) return stopRef.current?.();
    const { result, stop } = listenOnce(prefs.lang);
    stopRef.current = stop;
    setListening(true);
    try {
      const heard = (await result).trim();
      if (heard) await listen.ask(heard);
    } catch {
      /* microphone blocked or unsupported: the typed box still works */
    } finally {
      setListening(false);
    }
  }, [listening, prefs.lang, listen]);

  // Keyboard shortcuts: A ask, S score, W where, B ball sound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || !listen.started) return;
      const k = e.key.toLowerCase();
      if (k === "a" && canSpeak) void askByVoice();
      if (k === "s") listen.repeatScore();
      if (k === "w") listen.repeatWhere();
      if (k === "b") update({ ballSound: !prefs.ballSound });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listen, canSpeak, askByVoice, prefs.ballSound]);

  const latest = listen.log[0];
  const statusText =
    status === "finished"
      ? "Full time"
      : status === "paused"
        ? "Paused"
        : `Minute ${listen.minute}`;

  return (
    <div className="min-h-screen px-4 py-6">
      <main className="mx-auto max-w-xl space-y-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to the dashboard
        </Link>

        <header>
          <h1 className="flex items-center gap-3 font-display text-3xl font-semibold">
            <Headphones className="h-8 w-8 text-primary" aria-hidden />
            PitchPulse Listen
          </h1>
          <p className="mt-2 text-muted-foreground">
            Live football through sound. Put on headphones: the ball moves around you, and AI
            commentary tells you what matters.
          </p>
        </header>

        {!prefs.screenReader && (voice === "none" || voice === "no-language") && (
          <p role="alert" className="rounded-2xl bg-live/15 p-4 text-base">
            {VOICE_HELP[voice]} You can also turn on “Use my screen reader” under Personalise.
          </p>
        )}

        {/* Score: always visible, announced on request (S) rather than on every change. */}
        <section aria-label="Score" className="rounded-2xl glass-strong p-5 text-center">
          <p className="font-display text-4xl font-semibold">
            {TEAMS.home.short} {state.score.home} – {state.score.away} {TEAMS.away.short}
          </p>
          <p className="mt-1 text-lg text-muted-foreground">{statusText}</p>
        </section>

        {!listen.started ? (
          <section aria-labelledby="how" className="space-y-4">
            <button
              onClick={() => void listen.start()}
              className="w-full rounded-2xl bg-primary px-6 py-6 font-display text-2xl text-primary-foreground shadow-cta focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              Start listening
            </button>
            <div className="rounded-2xl glass-strong p-5">
              <h2 id="how" className="font-display text-lg">
                How it sounds
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base">
                <li>{TEAMS[prefs.favClub].name} always attack to your right.</li>
                <li>A soft hum follows the ball and rises as it nears a goal.</li>
                <li>Two rising notes: your team wins the ball. Falling notes: the opponent.</li>
                <li>A click is a pass, a whoosh is a shot, a fanfare is a goal.</li>
                <li>Ask anything out loud, like “who is winning?” or “how is Mensah doing?”</li>
              </ul>
            </div>
          </section>
        ) : (
          <section aria-label="Controls" className="grid grid-cols-2 gap-3">
            {canSpeak && (
              <button
                onClick={() => void askByVoice()}
                aria-pressed={listening}
                className={`col-span-2 flex items-center justify-center gap-3 rounded-2xl px-6 py-6 font-display text-2xl focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-foreground ${listening ? "bg-live text-white" : "bg-primary text-primary-foreground"}`}
              >
                <Mic className="h-7 w-7" aria-hidden />
                {listening
                  ? "Listening… tap to stop"
                  : listen.thinking
                    ? "Thinking…"
                    : "Ask a question"}
              </button>
            )}
            <BigButton
              onClick={listen.repeatScore}
              icon={<Trophy className="h-6 w-6" aria-hidden />}
            >
              Score
            </BigButton>
            <BigButton
              onClick={listen.repeatWhere}
              icon={<MapPin className="h-6 w-6" aria-hidden />}
            >
              Where's the ball
            </BigButton>
            <form
              className="col-span-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (typed.trim()) void listen.ask(typed.trim());
                setTyped("");
              }}
            >
              <label htmlFor="typed" className="sr-only">
                Type a question
              </label>
              <input
                id="typed"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Or type a question"
                className="min-w-0 flex-1 rounded-xl border border-border bg-muted/40 px-4 py-3 text-base"
              />
              <button className="rounded-xl bg-secondary px-4 py-3 text-base">Ask</button>
            </form>
            <BigButton
              onClick={listen.stop}
              icon={<Square className="h-5 w-5" aria-hidden />}
              className="col-span-2"
            >
              Stop listening
            </BigButton>
            <p className="col-span-2 text-sm text-muted-foreground">
              Keys: {canSpeak && "A ask, "}S score, W where, B ball sound.
            </p>
          </section>
        )}

        <Settings prefs={prefs} update={update} />

        <section aria-labelledby="said" className="rounded-2xl glass-strong p-5">
          <h2 id="said" className="font-display text-lg">
            Commentary
          </h2>
          <ol className="mt-3 space-y-2">
            {listen.log.length === 0 && (
              <li className="text-muted-foreground">Everything spoken appears here.</li>
            )}
            {listen.log.map((s) => (
              <LogLine key={s.id} s={s} />
            ))}
          </ol>
        </section>

        {/* Screen-reader mode: the user's own screen reader speaks, nothing else does. */}
        <div aria-live="assertive" className="sr-only">
          {prefs.screenReader && latest ? latest.text : ""}
        </div>
      </main>
    </div>
  );
}

function BigButton({
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
      className={`flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-5 font-display text-lg focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-foreground ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

const KIND_LABEL: Record<Spoken["kind"], string> = {
  match: "Match",
  ai: "AI",
  you: "You",
  answer: "Answer",
};

function LogLine({ s }: { s: Spoken }) {
  return (
    <li className="rounded-xl bg-muted/50 px-4 py-3 text-base">
      <span className="mr-2 text-xs uppercase tracking-wide text-muted-foreground">
        {KIND_LABEL[s.kind]}
      </span>
      {s.text}
    </li>
  );
}

function Settings({
  prefs,
  update,
}: {
  prefs: ListenPrefs;
  update: (patch: Partial<ListenPrefs>) => void;
}) {
  const field = "w-full rounded-xl border border-border bg-muted/40 px-3 py-3 text-base";
  return (
    <details className="rounded-2xl glass-strong p-5">
      <summary className="cursor-pointer font-display text-lg">Personalise</summary>
      <div className="mt-4 space-y-4">
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
            onChange={(e) => update({ favClub: e.target.value as TeamId })}
          >
            <option value="home">{TEAMS.home.name}</option>
            <option value="away">{TEAMS.away.name}</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span>Favourite player</span>
          <select
            className={field}
            value={prefs.favPlayer}
            onChange={(e) => update({ favPlayer: e.target.value })}
          >
            {PLAYERS.filter((p) => p.pos !== "GK").map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({TEAMS[p.team].short})
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2">
          <legend>Level of detail</legend>
          {DETAIL.map((d) => (
            <label key={d.id} className="flex items-start gap-3 rounded-xl bg-muted/40 p-3">
              <input
                type="radio"
                name="detail"
                className="mt-1 h-5 w-5"
                checked={prefs.detail === d.id}
                onChange={() => update({ detail: d.id })}
              />
              <span>
                {d.label}
                <span className="block text-sm text-muted-foreground">{d.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="block space-y-1">
          <span>Speaking speed: {prefs.rate.toFixed(1)}×</span>
          <input
            type="range"
            min={0.7}
            max={1.8}
            step={0.1}
            value={prefs.rate}
            onChange={(e) => update({ rate: Number(e.target.value) })}
            className="w-full"
          />
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={prefs.ballSound}
            onChange={(e) => update({ ballSound: e.target.checked })}
          />
          Ball sound
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5"
            checked={prefs.screenReader}
            onChange={(e) => update({ screenReader: e.target.checked })}
          />
          <span>
            Use my screen reader
            <span className="block text-sm text-muted-foreground">
              Commentary goes to your screen reader instead of the built-in voice.
            </span>
          </span>
        </label>
      </div>
    </details>
  );
}
