import { createFileRoute } from "@tanstack/react-router";
import { getSession, parseSeed, type HubMessage } from "@/match/hub";

// Live SSE stream of one shared synthetic match.
// - `?match=<fixture>` picks one of the fixtures playing at the same time.
// - `?seed=N` opens a private, reproducible replay instead of the shared match.
// - Reconnects send Last-Event-ID ("gen:seq") and receive only the events they missed.
export const Route = createFileRoute("/api/match/stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const session = getSession(
          parseSeed(url.searchParams.get("seed")),
          url.searchParams.get("match"),
        );
        const [genRaw, seqRaw] = (request.headers.get("last-event-id") ?? "").split(":");
        const lastGen = genRaw ? Number(genRaw) : null;
        const lastSeq = Number(seqRaw) || 0;

        const enc = new TextEncoder();
        let cleanup = () => {};
        const stream = new ReadableStream({
          start(ctrl) {
            const send = (m: HubMessage) => {
              const id = m.type === "event" ? `id: ${m.gen}:${m.seq}\n` : "";
              ctrl.enqueue(enc.encode(`${id}event: ${m.type}\ndata: ${JSON.stringify(m)}\n\n`));
            };
            ctrl.enqueue(enc.encode("retry: 2000\n\n"));
            send(session.statusMessage());
            // Missed events go out as one batch so clients can catch up without
            // treating every replayed event as a fresh live moment.
            const missed = session.replay(lastGen, lastSeq);
            const last = missed[missed.length - 1];
            const snapshot = { type: "snapshot", gen: session.gen, events: missed };
            ctrl.enqueue(
              enc.encode(
                `${last ? `id: ${last.gen}:${last.seq}\n` : ""}event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`,
              ),
            );
            const unsubscribe = session.subscribe(send);
            // Comment heartbeat keeps proxies and load balancers from closing idle streams.
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
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
