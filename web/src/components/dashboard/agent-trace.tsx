import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import type { Overlay, TraceStep, Verification } from "@/insights/agents.functions";

const AGENT_LABEL: Record<string, string> = {
  producer: "Producer",
  analyst: "Analyst",
  narrator: "Narrator",
  fact_checker: "Fact-Checker",
  recap_editor: "Recap Editor",
  engine: "Engine",
};

const STEP_TONE: Record<TraceStep["status"], string> = {
  ok: "border-win/40 text-win",
  retry: "border-primary/50 text-primary",
  skipped: "border-border text-muted-foreground",
  error: "border-destructive/50 text-destructive",
  timeout: "border-destructive/50 text-destructive",
};

/** Whether the text on screen passed the Fact-Checker, was repaired, or fell back. */
export function VerifiedBadge({ v }: { v: Verification }) {
  if (v.status === "pass")
    return (
      <span className="inline-flex items-center gap-1 text-win" title="Every number checked">
        <CheckCircle2 className="h-3 w-3" /> Verified
      </span>
    );
  if (v.status === "repaired")
    return (
      <span
        className="inline-flex items-center gap-1 text-primary"
        title="Fact-Checker rejected a draft; the Narrator fixed it"
      >
        <RefreshCw className="h-3 w-3" /> Repaired
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 text-muted-foreground"
      title={v.issues.join("\n") || "Deterministic explanation kept on air"}
    >
      <ShieldAlert className="h-3 w-3" /> Fallback
    </span>
  );
}

/** Agent handoffs for the last key moment: who ran, how long, and what happened. */
export function AgentTrace({ overlay }: { overlay: Overlay | null }) {
  if (!overlay) {
    return (
      <div className="text-xs text-muted-foreground">
        Agent trace appears after the next key moment.
      </div>
    );
  }
  const total = overlay.trace.reduce((a, s) => a + s.ms, 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="font-display text-foreground">{overlay.headline}</span>
        <span>{(total / 1000).toFixed(2)} s</span>
        {overlay.insight && (
          <span>
            Insight:{" "}
            <span className="text-foreground">{overlay.insight.category.replace(/_/g, " ")}</span>
          </span>
        )}
      </div>
      <ol className="flex flex-wrap items-center gap-1.5">
        {overlay.trace.map((s, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-muted-foreground">→</span>}
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] ${STEP_TONE[s.status]}`}
              title={s.note}
            >
              {AGENT_LABEL[s.agent] ?? s.agent} · {s.ms} ms
              {s.status !== "ok" && ` · ${s.status}`}
            </span>
          </li>
        ))}
      </ol>
      {overlay.insight && (
        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          Evidence:
          {overlay.insight.evidence.map((ev) => (
            <code key={ev.stat} className="rounded bg-muted/60 px-1.5">
              {ev.stat} = {String(ev.value)}
            </code>
          ))}
        </div>
      )}
      <ul className="space-y-1 text-[11px]">
        {overlay.narrations.map((n, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <span className="capitalize text-muted-foreground">
              {n.segment.persona} · {n.segment.language}
            </span>
            <VerifiedBadge v={n.verification} />
          </li>
        ))}
      </ul>
    </div>
  );
}
