import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  text: z.string().min(1).max(400),
  language: z.string().max(30),
});

// Spoken commentary from the voice service (voice/, Piper neural voices). Proxied so
// the voice service URL and token never reach the browser.
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });
        const base = process.env["VOICE_URL"] ?? "http://localhost:8001";
        const token = process.env["VOICE_TOKEN"];
        try {
          const res = await fetch(`${base}/tts`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(parsed.data),
            // A language's first line loads its voice, which can take several seconds.
            signal: AbortSignal.timeout(20000),
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
