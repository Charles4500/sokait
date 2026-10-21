import { MagicStar } from "iconsax-reactjs";
import { VerifiedBadge } from "./agent-trace";
import type { Verification } from "@/insights/agents.functions";
import { MODE_LABEL, type Prefs } from "./types";

/** Recap Editor output, with its Fact-Checker status. */
export function RecapPanel({
  recap,
  prefs,
  canRun,
}: {
  recap: { text: string; status: Verification | null; loading: boolean; run: () => void };
  prefs: Prefs;
  canRun: boolean;
}) {
  return (
    <section className="flex flex-col rounded-2xl glass-strong p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <MagicStar variant="Bulk" className="h-4 w-4 text-primary" />
          AI match recap
          {recap.status && (
            <span className="text-[11px] font-normal">
              <VerifiedBadge v={recap.status} />
            </span>
          )}
        </h2>
        <button
          onClick={recap.run}
          disabled={recap.loading || !canRun}
          className="rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
        >
          {recap.loading ? "Writing…" : recap.text ? "Update recap" : "Write recap"}
        </button>
      </div>
      <div className="mt-3 h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
        {recap.text ||
          `The Recap Editor agent writes a ${MODE_LABEL[prefs.mode].toLowerCase()} recap in ${prefs.lang}, checked against the match data.`}
      </div>
    </section>
  );
}
