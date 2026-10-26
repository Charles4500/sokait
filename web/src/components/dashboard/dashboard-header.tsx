import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HowItWorksSheet } from "./how-it-works-sheet";
import { PersonalisePopover } from "./personalise-popover";
import { MODE_LABEL, MODES, type Prefs } from "./types";

/** Brand · viewing mode · Listen, help and personalisation. */
export function DashboardHeader({
  prefs,
  update,
  listen,
  shortcuts,
}: {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  /** The Listen sheet trigger (audio mode). */
  listen: ReactNode;
  /** Keyboard shortcuts help. */
  shortcuts: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:gap-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2.5" title="All matches">
        <span className="inline-block h-6 w-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--pp-primary)]" />
        <span className="font-display text-lg font-semibold">Sokait</span>
      </Link>
      <div className="order-3 flex w-full items-center justify-between gap-1 rounded-full bg-muted/40 p-1 sm:order-none sm:mx-auto sm:w-auto sm:justify-start">
        <span className="hidden items-center gap-2 px-3 text-xs text-muted-foreground sm:flex">
          Viewing as
        </span>
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => update({ mode: m })}
            aria-pressed={prefs.mode === m}
            className={`flex-1 rounded-full px-3 py-1.5 font-display text-sm sm:flex-none sm:px-4 ${prefs.mode === m ? "bg-secondary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          {listen}
          {shortcuts}
          <HowItWorksSheet />
          <PersonalisePopover prefs={prefs} update={update} />
        </div>
      </TooltipProvider>
    </header>
  );
}
