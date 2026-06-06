import { RoomManager } from "./rooms/RoomManager";
import { handleWS } from "./ws/handler";
import { searchTracks } from "./music/youtube";

const roomManager = new RoomManager();
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

const server = Bun.serve({
  port: Number(process.env.PORT ?? 8080),
  hostname: "0.0.0.0",

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



    return new Response("Not found", { status: 404, headers: CORS });
  },

  websocket: {
    open(ws) { handleWS.open(ws, roomManager); },
    message(ws, raw) { handleWS.message(ws, raw, roomManager); },
    close(ws) { handleWS.close(ws, roomManager); },
  },
});

console.log(`✅ WaveSync server on http://localhost:${server.port}`);
