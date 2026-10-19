import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSession, parseSeed } from "@/match/hub";

const Body = z.object({
  action: z.enum(["pause", "resume", "restart"]),
  seed: z.number().int().min(0).max(0xffffffff).optional(),
  /** Seed of the private replay to control; omit for the shared match. */
  replaySeed: z.number().int().min(0).max(0xffffffff).optional(),
});

// Producer controls. When PRODUCER_TOKEN is set, the shared match requires
// `Authorization: Bearer <token>`; private replays (?seed) stay open to their viewer.
export const Route = createFileRoute("/api/match/control")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });
        const { action, seed, replaySeed } = parsed.data;

        const token = process.env["PRODUCER_TOKEN"];
        const isShared = replaySeed === undefined;
        if (isShared && token && request.headers.get("authorization") !== `Bearer ${token}`) {
          return Response.json({ error: "Producer token required" }, { status: 401 });
        }

        const session = getSession(parseSeed(replaySeed === undefined ? null : String(replaySeed)));
        if (action === "pause") session.pause();
        else if (action === "resume") session.resume();
        else session.restart(isShared ? seed : session.currentSeed);
        return Response.json(session.statusMessage());
      },
    },
  },
});
