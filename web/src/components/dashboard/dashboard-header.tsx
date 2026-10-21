import { Link } from "@tanstack/react-router";
import { Headphones } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HowItWorksSheet } from "./how-it-works-sheet";
import { PersonalisePopover } from "./personalise-popover";
import { MODE_LABEL, MODES, type Prefs } from "./types";

/** Brand · viewing mode · help and personalisation. */
export function DashboardHeader({
  prefs,
  update,
}: {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-border px-6 py-3">
      <div className="flex items-center gap-2.5">
        <span className="inline-block h-6 w-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--pp-primary)]" />
        <span className="font-display text-lg font-semibold">PitchPulse</span>
      </div>
      <div className="mx-auto flex items-center gap-1 rounded-full bg-muted/40 p-1">
        <span className="hidden items-center gap-2 px-3 text-xs text-muted-foreground sm:flex">
          Viewing as
        </span>
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => update({ mode: m })}
            aria-pressed={prefs.mode === m}
            className={`rounded-full px-4 py-1.5 font-display text-sm ${prefs.mode === m ? "bg-secondary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/listen"
                className="flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-secondary"
              >
                <Headphones className="h-4 w-4" aria-hidden />
                Listen
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              Follow the match by sound: built for blind and low-vision fans
            </TooltipContent>
          </Tooltip>
          <HowItWorksSheet />
          <PersonalisePopover prefs={prefs} update={update} />
        </div>
      </TooltipProvider>
    </header>
  );
}
