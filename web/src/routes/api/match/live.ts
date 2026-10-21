import { createFileRoute } from "@tanstack/react-router";
import { liveSessions } from "@/match/hub";

// Every fixture playing right now, for the "Live now" list: who, score, minute, status.
export const Route = createFileRoute("/api/match/live")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          liveSessions().map((s) => ({
            id: s.fixture.id,
            home: s.fixture.home.id,
            away: s.fixture.away.id,
            score: s.state.score,
            minute: Math.min(90, Math.floor(s.state.clock / 60)),
            status: s.status,
            gen: s.gen,
          })),
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
