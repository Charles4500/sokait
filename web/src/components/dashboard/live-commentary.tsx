import { MagicStar } from "iconsax-reactjs";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
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
      <div className="mt-3 h-[min(52vh,520px)] overflow-y-auto pr-1">
        {feed.length === 0 ? (
          <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
            Waiting for the first big moment…
          </p>
        ) : (
          <MessageGroup className="gap-4">
            {feed.map(({ e, why, ai, verification }) => (
              <Message key={e.id} className="animate-slide-in">
                <MessageAvatar className="self-start bg-transparent group-has-data-[slot=message-footer]/message:translate-y-0">
                  <Crest team={e.team} size={28} />
                </MessageAvatar>
                <MessageContent className="gap-1">
                  <MessageHeader className="gap-1.5 px-0 text-foreground">
                    <span className="font-display">{e.minute}'</span>
                    <span className="truncate">{e.label}</span>
                  </MessageHeader>
                  <div className="w-fit rounded-2xl rounded-tl-sm bg-muted/60 px-3 py-2 text-xs leading-relaxed">
                    {ai ?? why}
                  </div>
                  <MessageFooter className="gap-1.5 px-0 text-[10px]">
                    {verification ? (
                      <>
                        <MagicStar variant="Bulk" className="h-3 w-3 text-primary" aria-hidden />
                        AI ·
                        <VerifiedBadge v={verification} />
                      </>
                    ) : (
                      "Live analysis"
                    )}
                  </MessageFooter>
                </MessageContent>
              </Message>
            ))}
          </MessageGroup>
        )}
      </div>
    </section>
  );
}
