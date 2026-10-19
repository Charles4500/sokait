// Voice commentary through the browser's built-in speech synthesis (Web Speech API).
// No key and no server round trip; Azure AI Speech can replace this later.

const LANG_CODES: Record<string, string> = {
  English: "en-GB",
  Swahili: "sw-KE",
  Spanish: "es-ES",
  French: "fr-FR",
  Arabic: "ar-SA",
  Portuguese: "pt-PT",
};

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

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
