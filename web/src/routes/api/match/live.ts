import { createFileRoute } from "@tanstack/react-router";
import { liveSessions, upcomingFixtures } from "@/match/hub";

// The matchday: what's on each channel now (score, minute, status) and what's coming up.
export const Route = createFileRoute("/api/match/live")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            live: liveSessions().map((s) => ({
              id: s.fixture.id,
              home: s.fixture.home.id,
              away: s.fixture.away.id,
              score: s.state.score,
              minute: Math.min(90, Math.floor(s.state.clock / 60)),
              status: s.status,
              gen: s.gen,
            })),
            upcoming: upcomingFixtures(),
          },
          { headers: { "Cache-Control": "no-store" } },
        ),
    },
  },
});
