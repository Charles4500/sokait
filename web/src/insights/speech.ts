// Spoken commentary. Two engines:
//  - "browser": the Web Speech API, used only when the browser has a natural voice for
//    the language (Microsoft Edge's online voices, Chrome's Google voices).
//  - "server": Piper neural voices from the agent service via /api/tts. Used everywhere
//    else, e.g. Chrome on Linux (no voices) or Firefox (robotic espeak voices).

export const LANG_CODES: Record<string, string> = {
  English: "en-GB",
  Swahili: "sw-KE",
  Spanish: "es-ES",
  French: "fr-FR",
  Arabic: "ar-SA",
  Portuguese: "pt-PT",
};

const NATURAL = /natural|online|neural|google/i;

function naturalVoice(language: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const code = (LANG_CODES[language] ?? "en-GB").slice(0, 2);
  return (
    window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(code) && NATURAL.test(v.name)) ?? null
  );
}

/** Voices load asynchronously in some browsers: wait briefly once. */
let voicesLoaded: Promise<void> | null = null;
function loadVoices(): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
  voicesLoaded ??= new Promise((resolve) => {
    if (window.speechSynthesis.getVoices().length) return resolve();
    window.speechSynthesis.addEventListener("voiceschanged", () => resolve(), { once: true });
    setTimeout(resolve, 1500);
  });
  return voicesLoaded;
}

export interface Utterance {
  /** Resolves when speech ends (or fails); rejects with "unavailable" if no engine works. */
  done: Promise<void>;
  cancel: () => void;
}

/** Speak one line with the best available engine. */
export function speakLine(text: string, language: string, rate = 1): Utterance {
  let cancelled = false;
  let stopCurrent = () => {};
  const done = (async () => {
    await loadVoices();
    if (cancelled) return;
    const voice = naturalVoice(language);
    if (voice) {
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = rate;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        stopCurrent = () => {
          window.speechSynthesis.cancel();
          resolve();
        };
        window.speechSynthesis.speak(u);
      });
      return;
    }
    const controller = new AbortController();
    stopCurrent = () => controller.abort();
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
      signal: controller.signal,
    }).catch(() => null);
    if (cancelled) return;
    if (!res?.ok) throw new Error("unavailable");
    const url = URL.createObjectURL(await res.blob());
    if (cancelled) return URL.revokeObjectURL(url);
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audio.playbackRate = rate;
      const finish = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;
      stopCurrent = () => {
        audio.pause();
        finish();
      };
      audio.play().catch(finish);
    });
  })();
  return {
    done,
    cancel: () => {
      cancelled = true;
      stopCurrent();
    },
  };
}

export const VOICE_HELP =
  "Commentary can't be spoken right now: this browser has no natural voice and the voice service isn't reachable. Microsoft Edge has natural voices on every system. You can also turn on “Use my screen reader”.";

let busy = false;
/** Dashboard voice: speaks one line, skipping if already speaking so it never piles up.
 *  Resolves false if no engine could speak. */
export async function speak(text: string, language = "English"): Promise<boolean> {
  if (busy) return true;
  busy = true;
  try {
    await speakLine(text, language, 1.05).done;
    return true;
  } catch {
    return false;
  } finally {
    busy = false;
  }
}
