// Server functions that call the Python agent service (agents/). The service URL and
// token stay server-side. Every failure resolves to { ok: false } so the dashboard keeps
// its deterministic explanations on air.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Persona = "analyst" | "casual" | "player";
export interface Segment {
  persona: Persona;
  language: string;
  favourite_player: string | null;
  favourite_club: string | null;
}
export interface Verification {
  status: "pass" | "repaired" | "fallback";
  attempts: number;
  issues: string[];
}
export interface TraceStep {
  agent: string;
  ms: number;
  status: "ok" | "retry" | "skipped" | "error" | "timeout";
  note: string;
}
export interface Insight {
  category: string;
  claim: string;
  evidence: { stat: string; value: number | string }[];
}
export interface Overlay {
  schema: "smie.overlay.v2";
  match_id: string;
  moment_id: string;
  minute: number;
  show: boolean;
  duration_ms: number;
  headline: string;
  insight: Insight | null;
  narrations: { segment: Segment; text: string; verification: Verification }[];
  fallback: boolean;
  trace: TraceStep[];
}
export interface Recap {
  headline: string;
  bullets: string[];
  verification: Verification;
  trace: TraceStep[];
}

const SegmentIn = z.object({
  persona: z.enum(["analyst", "casual", "player"]),
  language: z.string().max(30),
  favourite_player: z.string().max(60).nullable(),
  favourite_club: z.string().max(60).nullable(),
});
const Team = z.object({ name: z.string().max(60), short: z.string().max(8) });
const Base = {
  match_id: z.string().max(40),
  moment_id: z.string().max(40),
  minute: z.number().int().min(0).max(130),
  score: z.record(z.string(), z.number().int()),
  stats: z.record(z.string(), z.unknown()),
  teams: z.object({ home: Team, away: Team }),
};
const MomentIn = z.object({
  ...Base,
  event: z.record(z.string(), z.unknown()),
  segments: z.array(SegmentIn).min(1).max(6),
  fallback_text: z.string().max(400),
});
const RecapIn = z.object({
  ...Base,
  segment: SegmentIn,
  key_moments: z.array(z.string().max(120)).max(30),
  mvp: z.string().max(60).nullable(),
});

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function callAgents<T>(path: string, body: unknown, timeoutMs: number): Promise<Result<T>> {
  const base = process.env["AGENTS_URL"] ?? "http://localhost:8000";
  const token = process.env["AGENTS_TOKEN"];
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, error: `Agent service ${res.status}` };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    return { ok: false, error: timedOut ? "Agent service timed out" : "Agent service unavailable" };
  }
}

/** Key moment → verified, per-segment overlay text from the agent team. */
export const analyseMoment = createServerFn({ method: "POST" })
  .inputValidator((d) => MomentIn.parse(d))
  // Agent service enforces its own live budget; this is a safety net above it.
  .handler(({ data }) => callAgents<Overlay>("/moments", data, 6000));

/** Match recap from the Recap Editor, grounded in aired insights. */
export const writeRecap = createServerFn({ method: "POST" })
  .inputValidator((d) => RecapIn.parse(d))
  .handler(({ data }) => callAgents<Recap>("/recap", data, 20000));
