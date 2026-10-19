import { Pause, Play, RotateCcw } from "lucide-react";
import { TEAMS, type Player } from "@/match/engine";
import type { MatchStatus } from "@/match/hub";
import { MODE_LABEL, type Prefs } from "./types";

/** Match title, live status, and producer controls for the shared match. */
export function MatchTitleBar({
  status,
  minute,
  prefs,
  fav,
  control,
}: {
  status: MatchStatus;
  minute: number;
  prefs: Prefs;
  fav: Player;
  control: (action: "pause" | "resume" | "restart") => Promise<void>;
}) {
  const running = status === "live";
  const label =
    status === "finished"
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
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => control(running ? "pause" : "resume").catch(() => {})}
          disabled={status === "finished"}
          className="flex items-center gap-1.5 rounded-full bg-muted/40 px-4 py-2 hover:bg-secondary disabled:opacity-50"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Pause" : "Resume"}
        </button>
        <button
          onClick={() => control("restart").catch(() => {})}
          className="flex items-center gap-1.5 rounded-full bg-muted/40 px-4 py-2 hover:bg-secondary"
        >
          <RotateCcw className="h-4 w-4" />
          Restart
        </button>
      </div>
    </div>
  );
}
