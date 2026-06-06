import { RoomManager } from "./rooms/RoomManager";
import { handleWS } from "./ws/handler";
import { searchTracks, getAudioStreamUrl } from "./music/youtube";

const roomManager = new RoomManager();
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8080),

  async fetch(req, server) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const ok = server.upgrade(req, { data: { userId: crypto.randomUUID(), roomCode: "" } });
      return ok ? undefined : new Response("WS upgrade failed", { status: 426 });
    }

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", rooms: roomManager.getActiveRoomCount(), ts: Date.now() }, { headers: CORS });
    }

    // Music search
    if (url.pathname === "/search") {
      const q = url.searchParams.get("q") ?? "";
      if (!q.trim()) return Response.json({ results: [] }, { headers: CORS });
      try {
        const results = await searchTracks(q);
        return Response.json({ results }, { headers: CORS });
      } catch (e) {
        console.error("[Search] Error:", e);
        return Response.json(
          { results: [], error: String(e) },
          { status: 500, headers: CORS }
        );
      }
    }

    // Audio stream proxy — THIS IS THE KEY FIX
    // Browser fetches audio from OUR server, we proxy from Piped
    if (url.pathname.startsWith("/stream/")) {
      const videoId = url.pathname.split("/stream/")[1];
      if (!videoId) return new Response("Missing video ID", { status: 400 });

      try {
        const audioUrl = await getAudioStreamUrl(videoId);
        // Pipe the audio stream through our server
        const upstream = await fetch(audioUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; WaveSync/1.0)",
            "Range": req.headers.get("Range") ?? "bytes=0-",
          },
        });

        if (!upstream.ok && upstream.status !== 206) {
          return new Response("Audio unavailable", { status: 502, headers: CORS });
        }

        const responseHeaders = {
          ...CORS,
          "Content-Type": upstream.headers.get("Content-Type") ?? "audio/webm",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        };

        const contentLength = upstream.headers.get("Content-Length");
        if (contentLength) responseHeaders["Content-Length"] = contentLength;
        const contentRange = upstream.headers.get("Content-Range");
        if (contentRange) responseHeaders["Content-Range"] = contentRange;

        return new Response(upstream.body, {
          status: upstream.status,
          headers: responseHeaders,
        });
      } catch (e) {
        console.error("[Stream]", e);
        return new Response("Stream error", { status: 500, headers: CORS });
      }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },

  websocket: {
    open(ws) { handleWS.open(ws, roomManager); },
    message(ws, raw) { handleWS.message(ws, raw, roomManager); },
    close(ws) { handleWS.close(ws, roomManager); },
  },
});

console.log(`✅ WaveSync server on http://localhost:${server.port}`);
