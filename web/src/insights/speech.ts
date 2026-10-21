// Voice commentary through the browser's built-in speech synthesis (Web Speech API).
// No key and no server round trip; Azure AI Speech can replace this later.

export const LANG_CODES: Record<string, string> = {
  English: "en-GB",
  Swahili: "sw-KE",
  Spanish: "es-ES",
  French: "fr-FR",
  Arabic: "ar-SA",
  Portuguese: "pt-PT",
};

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** "none": the browser has no voices at all (e.g. Chrome on Linux without speech-dispatcher).
 *  "no-language": voices exist, but none for this language. */
export type VoiceStatus = "checking" | "ok" | "no-language" | "none";

/** Voices load asynchronously; wait briefly for them before deciding. */
export function voiceStatus(language: string): Promise<VoiceStatus> {
  if (!speechSupported()) return Promise.resolve("none");
  const decide = (): VoiceStatus => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return "none";
    const code = (LANG_CODES[language] ?? "en-GB").slice(0, 2);
    return voices.some((v) => v.lang.toLowerCase().startsWith(code)) ? "ok" : "no-language";
  };
  if (window.speechSynthesis.getVoices().length) return Promise.resolve(decide());
  return new Promise((resolve) => {
    const done = () => resolve(decide());
    window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

export const VOICE_HELP: Record<Exclude<VoiceStatus, "checking" | "ok">, string> = {
  none: "This browser has no speech voices on this device, so nothing can be read aloud. Microsoft Edge has natural voices on every system; on Linux, Firefox also works, or start Chrome with its speech-dispatcher flag (see the README).",
  "no-language":
    "This browser has no voice for the chosen language, so a different voice will read it. Microsoft Edge has natural voices for all six languages.",
};

/** Speaks text in the viewer's language. Skips if already speaking, so commentary doesn't pile up. */
export function speak(text: string, language = "English"): Promise<void> {
  if (!speechSupported()) return Promise.resolve();
  const synth = window.speechSynthesis;
  if (synth.speaking || synth.pending) return Promise.resolve();
  const lang = LANG_CODES[language] ?? "en-GB";
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.voice =
    synth.getVoices().find((v) => v.lang === lang) ??
    synth.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2))) ??
    null;
  utterance.rate = 1.05;
  return new Promise((resolve) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  });
}
