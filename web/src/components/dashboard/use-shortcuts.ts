import { useEffect, useState } from "react";

export type ShortcutAction =
  | "fullscreen"
  | "toggle"
  | "back1"
  | "fwd1"
  | "back5"
  | "fwd5"
  | "start"
  | "live"
  | "voice"
  | "compare"
  | "mode"
  | "help"
  | "nextMatch"
  | "prevMatch"
  | `jump${number}`;

/** One table drives both the key handler and the help dialog. YouTube-style keys. */
export const SHORTCUTS: { keys: string[]; label: string; action: ShortcutAction }[] = [
  { keys: ["F"], label: "Full screen (Esc to exit)", action: "fullscreen" },
  { keys: ["K", "Space"], label: "Play / pause your view", action: "toggle" },
  { keys: ["←", "→"], label: "Back / forward 1 minute", action: "back1" },
  { keys: ["J", "L"], label: "Back / forward 5 minutes", action: "back5" },
  { keys: ["0–9"], label: "Jump to 0', 10' … 90'", action: "jump0" },
  { keys: ["Home"], label: "Kick-off", action: "start" },
  { keys: ["End"], label: "Go live", action: "live" },
  { keys: ["M"], label: "AI voice on / off", action: "voice" },
  { keys: ["C"], label: "Analyst vs Fan", action: "compare" },
  { keys: ["V"], label: "Next viewing mode", action: "mode" },
  { keys: ["N"], label: "Next live match", action: "nextMatch" },
  { keys: ["Shift", "N"], label: "Previous live match", action: "prevMatch" },
  { keys: ["?"], label: "Show shortcuts", action: "help" },
];

function actionFor(e: KeyboardEvent): ShortcutAction | null {
  if (e.key === "?") return "help";
  if (/^[0-9]$/.test(e.key)) return `jump${Number(e.key)}`;
  switch (e.key) {
    case "f":
    case "F":
      return "fullscreen";
    case "k":
    case "K":
    case " ":
      return "toggle";
    case "ArrowLeft":
      return "back1";
    case "ArrowRight":
      return "fwd1";
    case "j":
    case "J":
      return "back5";
    case "l":
    case "L":
      return "fwd5";
    case "Home":
      return "start";
    case "End":
      return "live";
    case "m":
    case "M":
      return "voice";
    case "c":
    case "C":
      return "compare";
    case "v":
    case "V":
      return "mode";
    case "n":
      return "nextMatch";
    case "N":
      return "prevMatch";
  }
  return null;
}

/** Global keyboard shortcuts, ignored while typing or inside dialogs, sheets and menus. */
export function useShortcuts(run: (action: ShortcutAction) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) || el.isContentEditable;
      // Sheets, dialogs and menus own the keyboard while open (Listen has its own keys).
      const inOverlay = !!el.closest('[role="dialog"], [role="menu"], [role="listbox"]');
      if (typing || inOverlay) return;
      const action = actionFor(e);
      if (!action) return;
      e.preventDefault();
      run(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);
}

/** Brief YouTube-style flash on the video showing what a shortcut did. */
export function useFlash() {
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 700);
    return () => clearTimeout(t);
  }, [flash]);
  return {
    flash,
    show: (text: string) => setFlash({ id: Date.now(), text }),
  };
}
