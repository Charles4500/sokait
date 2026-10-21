import { useEffect, useRef, useState } from "react";
import { MagicStar, Microphone2, Send2 } from "iconsax-reactjs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageHeader,
} from "@/components/ui/message";
import { askAboutMatch, type AskContext, type AskResult } from "@/insights/ask-match";
import { speak } from "@/insights/speech";
import { listenOnce, listeningSupported } from "@/listen/voice";
import { VerifiedBadge } from "./agent-trace";

interface Turn {
  id: number;
  who: "you" | "ai";
  text: string;
  result?: AskResult;
}

const SUGGESTIONS = ["Who's winning?", "How is my player doing?", "Why does it matter?"];

/** Floating "Ask the match" assistant: type or speak a question about the live match. */
export function MatchAssistant({ ctx, voice }: { ctx: AskContext; voice: boolean }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const nextId = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setCanSpeak(listeningSupported());
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking]);
  // A new match starts a new conversation.
  useEffect(() => {
    setTurns([]);
  }, [ctx.matchId]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || thinking) return;
    setDraft("");
    setTurns((t) => [...t, { id: nextId.current++, who: "you", text: q }]);
    setThinking(true);
    const result = await askAboutMatch(q, ctx);
    setThinking(false);
    setTurns((t) => [...t, { id: nextId.current++, who: "ai", text: result.answer, result }]);
    if (voice) void speak(result.answer, ctx.lang);
  };

  const askByVoice = async () => {
    if (listening) return;
    setListening(true);
    try {
      const heard = (await listenOnce(ctx.lang).result).trim();
      if (heard) await ask(heard);
    } catch {
      /* microphone blocked: typing still works */
    } finally {
      setListening(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Ask the match"
        className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-cta transition-transform hover:scale-105 data-[state=open]:scale-95"
      >
        <MagicStar variant="Bulk" className="h-6 w-6" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        className="flex h-[min(520px,70vh)] w-[min(380px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden border border-white/10 bg-background/90 p-0 backdrop-blur-xl"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MagicStar variant="Bulk" className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-sm font-semibold">Ask the match</h2>
            <p className="text-[11px] text-muted-foreground">
              Answers come from the match data and are fact-checked.
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
          {turns.length === 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Ask anything about this match, by typing or with the mic.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void ask(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <MessageGroup className="gap-3">
              {turns.map((t) => (
                <Message key={t.id} align={t.who === "you" ? "end" : "start"}>
                  {t.who === "ai" && (
                    <MessageAvatar className="size-7 self-start bg-primary/15 group-has-data-[slot=message-footer]/message:translate-y-0">
                      <MagicStar variant="Bulk" className="h-3.5 w-3.5 text-primary" />
                    </MessageAvatar>
                  )}
                  <MessageContent className="gap-1">
                    {t.who === "ai" && (
                      <MessageHeader className="gap-1.5 px-1 text-[10px]">
                        Match assistant
                        {t.result?.source === "device" && <span>· instant</span>}
                        {t.result?.verification && <VerifiedBadge v={t.result.verification} />}
                      </MessageHeader>
                    )}
                    <div
                      className={`w-fit max-w-[85%] rounded-2xl px-3 py-2 text-sm ${t.who === "you" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                    >
                      {t.text}
                    </div>
                  </MessageContent>
                </Message>
              ))}
              {thinking && (
                <p className="px-9 text-xs text-muted-foreground animate-live">Thinking…</p>
              )}
            </MessageGroup>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(draft);
          }}
        >
          <label htmlFor="ask-match" className="sr-only">
            Your question
          </label>
          <input
            id="ask-match"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={listening ? "Listening…" : "Ask about the match"}
            className="min-w-0 flex-1 rounded-full border border-border bg-muted/40 px-4 py-2 text-sm"
            autoComplete="off"
          />
          {canSpeak && (
            <button
              type="button"
              onClick={() => void askByVoice()}
              aria-label="Ask by voice"
              aria-pressed={listening}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${listening ? "bg-live text-white animate-live" : "bg-secondary"}`}
            >
              <Microphone2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || thinking}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send2 variant="Bold" className="h-4 w-4" />
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
