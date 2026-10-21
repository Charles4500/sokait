import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  text: z.string().min(1).max(400),
  language: z.string().max(30),
});

// Spoken commentary from the agent service's Piper voices. Proxied so the agent
// service URL and token never reach the browser.
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });
        const base = process.env["AGENTS_URL"] ?? "http://localhost:8000";
        const token = process.env["AGENTS_TOKEN"];
        try {
          const res = await fetch(`${base}/tts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(parsed.data),
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return Response.json({ error: "No voice" }, { status: res.status });
          return new Response(res.body, {
            headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=3600" },
          });
        } catch {
          return Response.json({ error: "Voice unavailable" }, { status: 503 });
        }
      },
    },
  },
});
