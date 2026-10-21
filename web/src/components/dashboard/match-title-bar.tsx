import { RotateLeft } from "iconsax-reactjs";
import { TEAMS, type Player } from "@/match/engine";
import type { MatchStatus } from "@/match/hub";
import { MODE_LABEL, type Prefs } from "./types";

/** Match title, live or replay status, and a restart for the shared match.
 *  (Pausing your own view lives on the timeline.) */
export function MatchTitleBar({
  isLive,
  status,
  minute,
  prefs,
  fav,
  control,
}: {
  isLive: boolean;
  status: MatchStatus;
  minute: number;
  prefs: Prefs;
  fav: Player;
  control: (action: "pause" | "resume" | "restart") => Promise<void>;
}) {
  const running = isLive && status === "live";
  const label = !isLive
    ? `Replay · ${minute}'`
    : status === "finished"
      ? "Full time"
      : status === "paused"
        ? `Paused · ${minute}'`
        : `Live · ${minute}'`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl">
          {TEAMS.home.name} vs {TEAMS.away.name}
        </h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`flex items-center gap-1.5 ${running ? "text-live" : ""}`}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${running ? "bg-live animate-live" : "bg-muted-foreground"}`}
            />
            {label}
          </span>
          · {MODE_LABEL[prefs.mode]} · {prefs.lang}
          {prefs.mode === "player" && ` · ★ ${fav.name}`}
        </div>
      </div>
      <button
        onClick={() => control("restart").catch(() => {})}
        className="flex items-center gap-1.5 rounded-full bg-muted/40 px-4 py-2 text-sm hover:bg-secondary"
      >
        <RotateLeft className="h-4 w-4" />
        Restart match
      </button>
    </div>
  );
}
