import { Cpu, InfoCircle, LampCharge, Monitor, Radio, UserEdit } from "iconsax-reactjs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const STAGES = [
  {
    I: Radio,
    n: "Ingest",
    brief: "Ingest synthetic match events as they happen",
    how: "A seeded match simulator on the server emits passes, shots, tackles, possession changes and pressure events, and streams one shared match to every viewer over SSE.",
  },
  {
    I: Cpu,
    n: "Interpret",
    brief: "Interpret them into meaningful statistics and patterns",
    how: "Pure code computes xG, pass accuracy and difficulty, ball and shot speed, pressing, control vs chaos, momentum and win probability on every event.",
  },
  {
    I: LampCharge,
    n: "Explain",
    brief: "Explain why a moment matters",
    how: "A team of agents (Producer, Analyst, Narrator, Fact-Checker) picks the moments that matter and says why. Every number is checked against the match data before it airs.",
  },
  {
    I: Monitor,
    n: "Render",
    brief: "Render insight on screen alongside the match",
    how: "Timed overlays and player tags on the live view, plus a machine-readable SSE feed for broadcast graphics partners.",
  },
  {
    I: UserEdit,
    n: "Personalise",
    brief: "Same intelligence, genuinely different experiences",
    how: "Casual fan, Analyst and Player focus modes, favourite club and player, six languages, voice commentary, and a side-by-side Analyst vs Fan view.",
  },
];

export function HowItWorksSheet() {
  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger asChild>
          <SheetTrigger
            aria-label="How it works"
            className="grid h-10 w-10 place-items-center rounded-full border border-border data-[state=open]:bg-secondary"
          >
            <InfoCircle className="h-4 w-4" />
          </SheetTrigger>
        </TooltipTrigger>
        <TooltipContent>How it works</TooltipContent>
      </Tooltip>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>One pipeline. Five stages.</SheetTitle>
          <SheetDescription>
            Synthetic football events become explainable match intelligence, live narratives and
            recaps for studio, broadcast and every fan.
          </SheetDescription>
        </SheetHeader>

        <ol className="mt-6 space-y-3">
          {STAGES.map(({ I, n, brief, how }, i) => (
            <li key={n} className="rounded-2xl glass-strong p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20">
                  <I className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Stage {i + 1}</div>
                  <div className="font-display">{n}</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">“{brief}”</p>
              <p className="mt-1 text-sm">{how}</p>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-2xl glass-strong p-4 text-sm">
          <div className="font-display">Broadcast feed</div>
          <code className="mt-2 block break-all text-xs text-muted-foreground">
            GET /api/public/feed
          </code>
          <p className="mt-2 text-muted-foreground">
            Server-Sent Events. Each message carries the event, score, live stats and an overlay
            block with headline, explanation, player tag and display duration.
          </p>
          <a
            href="/api/public/feed"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-primary-foreground"
          >
            Open the feed
          </a>
        </div>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          All data is synthetic and football-realistic.
        </p>
      </SheetContent>
    </Sheet>
  );
}
