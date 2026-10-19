import { VerifiedBadge } from "./agent-trace";
import { Crest } from "./crest";
import type { FeedItem } from "./types";

/** Key moments and why they matter, beside the video like a live chat. */
export function LiveCommentary({ feed }: { feed: FeedItem[] }) {
  return (
    <section className="flex flex-col rounded-2xl glass-strong p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-live animate-live" />
          Live commentary
        </h2>
        <span className="text-[11px] text-muted-foreground">Why each moment matters</span>
      </div>
      <div className="mt-3 h-[min(52vh,520px)] space-y-2 overflow-y-auto pr-1">
        {feed.length === 0 && (
          <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Waiting for the first big moment…
          </div>
        )}
        {feed.map(({ e, why, ai, verification }) => (
          <div key={e.id} className="rounded-xl bg-muted/50 p-3 animate-slide-in">
            <div className="flex items-center gap-2 text-xs">
              <Crest team={e.team} size={20} />
              <span className="font-display">{e.minute}'</span>
              <span className="min-w-0 truncate">{e.label}</span>
              {verification && (
                <span className="ml-auto shrink-0 text-[10px]">
                  <VerifiedBadge v={verification} />
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{ai ?? why}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
