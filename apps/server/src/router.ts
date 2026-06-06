import { join } from "path";
import { RoomManager } from "./rooms/RoomManager";
import { UploadProvider } from "./providers/UploadProvider";
import { YouTubeProvider } from "./providers/YouTubeProvider";
import { SoundCloudProvider } from "./providers/SoundCloudProvider";
import { roomCreationRateLimiter } from "./utils/rateLimit";
import { logger } from "./utils/logger";
import { Server } from "bun";

const youtubeProvider = new YouTubeProvider();
const soundcloudProvider = new SoundCloudProvider();

export async function router(req: Request, roomManager: RoomManager, server: Server): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Add CORS headers to all HTTP responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ─── GET /health ───────────────────────────────────────────────
  if (req.method === "GET" && path === "/health") {
    return new Response(
      JSON.stringify({
        status: "ok",
        rooms: roomManager.getActiveRoomCount(),
        clients: roomManager.getActiveClientCount(),
        uptime: process.uptime(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  // ─── POST /rooms ──────────────────────────────────────────────
  if (req.method === "POST" && path === "/rooms") {
    const clientIp = server.requestIP(req)?.address || "unknown-ip";
    if (roomCreationRateLimiter.isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Max 10 room creations per hour." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    roomManager.getOrCreate(code);
    
    return new Response(
      JSON.stringify({ roomCode: code }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  // ─── GET /rooms/:code ─────────────────────────────────────────
  if (req.method === "GET" && path.startsWith("/rooms/")) {
    const code = path.split("/").pop() || "";
    const room = roomManager.get(code);
    if (!room) {
      return new Response(
        JSON.stringify({ error: "Room not found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
    return new Response(
      JSON.stringify({
        roomCode: room.state.code,
        isPlaying: room.state.isPlaying,
        currentTrack: room.state.currentTrack,
        usersCount: room.clientCount(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }

  // ─── POST /upload ─────────────────────────────────────────────
  if (req.method === "POST" && path === "/upload") {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "No file provided" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
      
      const streamUrl = await UploadProvider.uploadFile(file);
      logger.info({ fileName: file.name, url: streamUrl }, "Audio uploaded successfully");

      return new Response(
        JSON.stringify({
          success: true,
          audioUrl: streamUrl,
          title: file.name.replace(/\.[^/.]+$/, ""), // strip extension
          durationMs: 240000, // placeholder, client decodes duration locally
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (err: any) {
      logger.error({ err }, "Upload error");
      return new Response(
        JSON.stringify({ error: err.message || "Upload failed" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }

  // ─── GET /search ──────────────────────────────────────────────
  if (req.method === "GET" && path === "/search") {
    const searchParams = url.searchParams;
    const query = searchParams.get("q") || "";
    const source = searchParams.get("src") || "youtube";

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query parameter 'q' is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    try {
      let provider;
      if (source === "youtube") {
        provider = youtubeProvider;
      } else if (source === "soundcloud") {
        provider = soundcloudProvider;
      } else {
        return new Response(
          JSON.stringify({ error: "Invalid source. Must be 'youtube' or 'soundcloud'" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      const results = await provider.search(query);
      return new Response(
        JSON.stringify(results),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (err: any) {
      logger.error({ err }, "Search error");
      return new Response(
        JSON.stringify({ error: "Search query failed" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }

  // ─── GET /resolve-audio ─────────────────────────────────────────
  if (req.method === "GET" && path === "/resolve-audio") {
    const id = url.searchParams.get("id") || "";
    if (!id) {
      return new Response(
        JSON.stringify({ error: "ID parameter is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    try {
      const audioUrl = await youtubeProvider.getStreamUrl(id);
      return new Response(
        JSON.stringify({ audioUrl }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } catch (err: any) {
      logger.error({ err, id }, "Failed to resolve stream URL");
      return new Response(
        JSON.stringify({ error: "Could not resolve audio" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  }

  // ─── GET /uploads/:filename (Local File Storage fallback server)
  if (req.method === "GET" && path.startsWith("/uploads/")) {
    const filename = path.replace("/uploads/", "");
    const filePath = join(process.cwd(), "uploads", filename);
    const file = Bun.file(filePath);
    
    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": file.type || "audio/mpeg",
          "Accept-Ranges": "bytes", // essential HTTP 206 for client Web Audio seek/jitter control
          ...corsHeaders,
        },
      });
    }
    
    return new Response("File Not Found", { status: 404, headers: corsHeaders });
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}
