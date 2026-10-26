// Speech in and out for Sokait Listen.
import { LANG_CODES, speakLine, type Utterance } from "@/insights/speech";

export type Priority = "low" | "normal" | "high";
const RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2 };

/**
 * Speaks lines in order. A high-priority line (a goal, an answer to a question) cuts in
 * immediately; low-priority lines ("every touch" detail) are dropped rather than queued
 * so commentary never falls behind the match.
 */
export class Announcer {
  private queue: { text: string; priority: Priority }[] = [];
  private speaking: Priority | null = null;
  private current: Utterance | null = null;
  rate = 1.1;
  language = "English";
  /** When on, nothing is spoken here: the page's live region feeds the screen reader. */
  screenReader = false;
  /** Called when no engine could speak (no natural browser voice, voice service down). */
  onUnavailable: () => void = () => {};

  say(text: string, priority: Priority = "normal") {
    if (this.screenReader || typeof window === "undefined") return;
    if (priority === "low" && (this.speaking !== null || this.queue.length)) return;
    if (this.speaking !== null && RANK[priority] > RANK[this.speaking]) {
      this.queue = this.queue.filter((q) => RANK[q.priority] >= RANK[priority]);
      this.current?.cancel();
      this.current = null;
      this.speaking = null;
    }
    this.queue.push({ text, priority });
    this.queue.sort((a, b) => RANK[b.priority] - RANK[a.priority]);
    this.next();
  }

  stop() {
    this.queue = [];
    this.current?.cancel();
    this.current = null;
    this.speaking = null;
  }

  private next() {
    if (this.speaking !== null) return;
    const item = this.queue.shift();
    if (!item) return;
    this.speaking = item.priority;
    const u = speakLine(item.text, this.language, this.rate);
    this.current = u;
    u.done
      .catch(() => this.onUnavailable())
      .finally(() => {
        if (this.current !== u) return; // cancelled by a higher-priority line
        this.current = null;
        this.speaking = null;
        this.next();
      });
  }
}

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as
    (new () => Recognition) | null;
}

export const listeningSupported = () => recognitionClass() !== null;

/** Longest a question can take; some browsers never end the session on their own. */
const LISTEN_LIMIT_MS = 10_000;

/** Listens for one spoken question. Resolves with the transcript ("" if nothing heard);
 *  rejects with the recognition error code (e.g. "not-allowed", "network"). */
export function listenOnce(language: string): { result: Promise<string>; stop: () => void } {
  const Rec = recognitionClass();
  if (!Rec) return { result: Promise.reject(new Error("unsupported")), stop: () => {} };
  const rec = new Rec();
  rec.lang = LANG_CODES[language] ?? "en-GB";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let heard = "";
  let finish: (() => void) | undefined;
  const result = new Promise<string>((resolve, reject) => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const done = (err?: string) => {
      timers.forEach(clearTimeout);
      if (err) reject(new Error(err));
      else resolve(heard);
    };
    rec.onresult = (e) => {
      heard = e.results[0]?.[0]?.transcript ?? "";
    };
    rec.onerror = (e) =>
      done(e.error === "no-speech" || e.error === "aborted" ? undefined : e.error);
    rec.onend = () => done();
    // Stop asking for audio at the limit, and give up if the browser never reports back.
    finish = () => {
      rec.stop();
      timers.push(setTimeout(() => (rec.abort(), done()), 1500));
    };
    timers.push(setTimeout(finish, LISTEN_LIMIT_MS));
    try {
      rec.start();
    } catch {
      done("start-failed");
    }
  });
  return { result, stop: () => finish?.() };
}

/** What to tell the fan when listening fails, by recognition error code. */
export function listenErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "not-allowed" || code === "service-not-allowed")
    return "The microphone is blocked. Allow it from the icon in the address bar, then try again.";
  if (code === "audio-capture")
    return "No microphone was found. You can type your question instead.";
  if (code === "network" || code === "unsupported" || code === "start-failed")
    return "Voice questions don't work in this browser. Try Chrome or Edge, or type your question.";
  return "I couldn't hear that. Try again, or type your question.";
}
