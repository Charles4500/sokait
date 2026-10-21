import { createFileRoute } from "@tanstack/react-router";
import { computeStats, explain, playerTag } from "@/match/engine";
import { getSession, parseSeed, type HubMessage } from "@/match/hub";

// Public, read-only machine feed of SYNTHETIC match data for broadcast overlay partners.
// Server-Sent Events, schema "smie.overlay.v1". Follows the same live match as the
// dashboard (or a private replay with `?seed=N`). No private data.
export const Route = createFileRoute("/api/public/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const session = getSession(
          parseSeed(url.searchParams.get("seed")),
          url.searchParams.get("match"),
        );
        const enc = new TextEncoder();
        let cleanup = () => {};
        const stream = new ReadableStream({
          start(ctrl) {
            const send = (m: HubMessage) => {
              if (m.type === "status") {
                ctrl.enqueue(enc.encode(`event: status\ndata: ${JSON.stringify(m)}\n\n`));
                return;
              }
              const events = session.state.events;
              const e = m.event;
              const upTo = events.slice(0, events.findIndex((x) => x.id === e.id) + 1);
              const stats = computeStats(upTo);
              const payload = {
                schema: "smie.overlay.v1",
                matchId: session.id,
                t: m.clock,
                event: {
                  ...e,
                  player: e.player.name,
                  playerId: e.player.id,
                  target: e.target?.name,
                },
                score: m.score,
                overlay: {
                  show: e.importance >= 0.6,
                  durationMs: e.type === "goal" ? 8000 : 4500,
                  headline: `${e.minute}' ${e.label}`,
                  explanation: explain(e, stats),
                  playerTag: playerTag(upTo, e),
                },
                stats,
              };
              ctrl.enqueue(
                enc.encode(
                  `id: ${m.gen}:${m.seq}\nevent: match\ndata: ${JSON.stringify(payload)}\n\n`,
                ),
              );
            };
            send(session.statusMessage());
            const unsubscribe = session.subscribe(send);
            const heartbeat = setInterval(() => ctrl.enqueue(enc.encode(": ping\n\n")), 15000);
            cleanup = () => {
              unsubscribe();
              clearInterval(heartbeat);
              try {
                ctrl.close();
              } catch {
                // already closed
              }
            };
            request.signal.addEventListener("abort", () => cleanup());
          },
          cancel() {
            cleanup();
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
