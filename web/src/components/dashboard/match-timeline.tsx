import { Maximize4, Pause, Play, VolumeHigh, VolumeSlash } from "iconsax-reactjs";
import { MATCH_LENGTH_S, type MatchEvent } from "@/match/engine";
import { clockOf } from "@/match/use-playback";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const pct = (s: number) => `${Math.min(100, (s / MATCH_LENGTH_S) * 100)}%`;
/** Jump a few seconds before a marked moment, so you see the build-up. */
const LEAD_IN_S = 45;

/** Live timeline under the pitch: scrub back, replay, or jump to a big moment. */
export function MatchTimeline({
  events,
  liveClock,
  viewClock,
  isLive,
  playing,
  finished,
  onSeek,
  onToggle,
  onGoLive,
  onFullscreen,
  voice,
  onVoice,
}: {
  events: MatchEvent[];
  liveClock: number;
  viewClock: number;
  isLive: boolean;
  playing: boolean;
  finished: boolean;
  onSeek: (clock: number) => void;
  onToggle: () => void;
  onGoLive: () => void;
  onFullscreen: () => void;
  /** AI voice commentary on or off (off by default). */
  voice: boolean;
  onVoice: () => void;
}) {
  const markers = events.filter((e) => e.type === "goal" || e.importance >= 0.7);
  const behind = liveClock - viewClock;

  return (
    <div className="flex items-center gap-3 rounded-xl glass px-3 py-2">
      <button
        onClick={onToggle}
        aria-label={playing ? "Pause your view" : "Play"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-secondary"
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <button
        onClick={onVoice}
        aria-pressed={voice}
        aria-label={voice ? "Turn AI voice off (M)" : "Turn AI voice on (M)"}
        title={voice ? "AI voice on (M)" : "AI voice off (M)"}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-secondary ${voice ? "text-primary" : "text-muted-foreground"}`}
      >
        {voice ? (
          <VolumeHigh variant="Bold" className="h-4 w-4" />
        ) : (
          <VolumeSlash className="h-4 w-4" />
        )}
      </button>

      <div className="relative h-6 min-w-0 flex-1">
        {/* Track: what has been played so far, and where you are */}
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted-foreground/40"
          style={{ width: pct(liveClock) }}
        />
        <div
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-live"
          style={{ width: pct(viewClock) }}
        />
        {/* Goals and big chances: click to replay from just before */}
        {markers.map((e) => (
          <button
            key={e.id}
            onClick={() => onSeek(Math.max(0, clockOf(e) - LEAD_IN_S))}
            title={`${e.minute}' ${e.label}`}
            aria-label={`Replay ${e.minute}' ${e.label}`}
            className={`absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background ${e.type === "goal" ? "h-3.5 w-3.5" : "h-2 w-2"} ${e.team === "home" ? "bg-team-home" : "bg-team-away"}`}
            style={{ left: pct(clockOf(e)) }}
          />
        ))}
        {/* Accessible scrubber over the track; you can't seek past live */}
        <input
          type="range"
          min={0}
          max={Math.max(1, liveClock)}
          step={1}
          value={Math.min(viewClock, liveClock)}
          onChange={(ev) => onSeek(Number(ev.target.value))}
          aria-label="Match timeline"
          aria-valuetext={
            isLive ? `Live, ${fmt(liveClock)}` : `${fmt(viewClock)}, ${fmt(behind)} behind live`
          }
          className="absolute left-0 top-0 h-full cursor-pointer opacity-0"
          style={{ width: pct(liveClock) }}
        />
        <div
          className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-live shadow"
          style={{ left: pct(viewClock) }}
        />
      </div>

      <span className="shrink-0 font-display text-xs tabular-nums">
        {fmt(viewClock)}
        {!isLive && <span className="text-muted-foreground"> · {fmt(behind)} behind</span>}
      </span>

      {isLive ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-live px-2 py-0.5 text-[11px] font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-live" />
          {finished ? "FT" : "LIVE"}
        </span>
      ) : (
        <button
          onClick={onGoLive}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold hover:bg-secondary"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          {finished ? "Jump to end" : "Go live"}
        </button>
      )}
      <button
        onClick={onFullscreen}
        aria-label="Full screen (F)"
        title="Full screen (F)"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-secondary"
      >
        <Maximize4 className="h-4 w-4" />
      </button>
    </div>
  );
}
