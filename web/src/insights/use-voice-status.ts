import { useEffect, useState } from "react";
import { voiceStatus, type VoiceStatus } from "./speech";

/** Whether this browser can actually speak the given language. */
export function useVoiceStatus(language: string, enabled = true): VoiceStatus {
  const [status, setStatus] = useState<VoiceStatus>("checking");
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void voiceStatus(language).then((s) => live && setStatus(s));
    return () => {
      live = false;
    };
  }, [language, enabled]);
  return status;
}
