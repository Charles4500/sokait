// Speech in and out for PitchPulse Listen.
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
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"] ?? null) as
    (new () => Recognition) | null;
}

export const listeningSupported = () => recognitionClass() !== null;

/** Listens for one spoken question. Resolves with the transcript ("" if nothing heard). */
export function listenOnce(language: string): { result: Promise<string>; stop: () => void } {
  const Rec = recognitionClass();
  if (!Rec) return { result: Promise.reject(new Error("unsupported")), stop: () => {} };
  const rec = new Rec();
  rec.lang = LANG_CODES[language] ?? "en-GB";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  const result = new Promise<string>((resolve, reject) => {
    let heard = "";
    rec.onresult = (e) => {
      heard = e.results[0]?.[0]?.transcript ?? "";
    };
    rec.onerror = (e) => (e.error === "no-speech" ? resolve("") : reject(new Error(e.error)));
    rec.onend = () => resolve(heard);
  });
  rec.start();
  return { result, stop: () => rec.stop() };
}
