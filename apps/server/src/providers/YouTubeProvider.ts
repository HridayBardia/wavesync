import { MusicProvider, SearchResult } from "./MusicProvider";
import { logger } from "../utils/logger";
import { $ } from "bun";

export class YouTubeProvider implements MusicProvider {
  // Pre-configured working tracks for zero-config out-of-the-box experience
  private static mockTracks: SearchResult[] = [
    {
      id: "yt-1",
      title: "Lofi Chill Beats - Ambient Study Mix",
      artist: "Lofi Station",
      durationMs: 300000,
      thumbnailUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300",
      streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      source: "youtube",
    },
    {
      id: "yt-2",
      title: "Synthwave Retro Future",
      artist: "Neon Rider",
      durationMs: 302000,
      thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300",
      streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      source: "youtube",
    },
    {
      id: "yt-3",
      title: "Energetic Gaming Music",
      artist: "NCS Release",
      durationMs: 304000,
      thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300",
      streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      source: "youtube",
    }
  ];

  async search(query: string): Promise<SearchResult[]> {
    logger.info({ query }, "YouTube search query received");
    
    // If it looks like a URL, wrap it in a SearchResult
    if (query.startsWith("http://") || query.startsWith("https://")) {
      let ytId = "";
      try {
        const url = new URL(query);
        if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
          ytId = url.searchParams.get("v") || url.pathname.split("/").pop() || "";
        }
      } catch (e) {}

      return [
        {
          id: ytId || Buffer.from(query).toString("base64"),
          title: "URL Playback Source",
          artist: "Direct Link",
          durationMs: 300000, // default placeholder
          thumbnailUrl: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=300",
          streamUrl: query,
          source: "youtube",
        }
      ];
    }

    // Try yt-dlp search first
    try {
      const result = await $`yt-dlp "ytsearch5:${query}" --dump-json --flat-playlist --no-playlist`.text();
      const lines = result.trim().split("\n").filter(Boolean);
      if (lines.length > 0) {
        return lines.map((line) => {
          const item = JSON.parse(line);
          return {
            id: item.id,
            title: item.title,
            artist: item.uploader ?? item.channel ?? "",
            durationMs: (item.duration ?? 0) * 1000,
            thumbnailUrl: item.thumbnail ?? `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
            streamUrl: `https://www.youtube.com/watch?v=${item.id}`,
            source: "youtube",
          };
        });
      }
    } catch (err) {
      logger.warn({ err }, "yt-dlp search failed, falling back to mock search");
    }

    const q = query.toLowerCase();
    const results = YouTubeProvider.mockTracks.filter(
      t => t.title.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q)
    );

    return results.length > 0 ? results : YouTubeProvider.mockTracks;
  }

  async getStreamUrl(id: string): Promise<string> {
    logger.info({ id }, "YouTube getStreamUrl received");

    const mockTrack = YouTubeProvider.mockTracks.find(t => t.id === id);
    if (mockTrack) {
      return mockTrack.streamUrl;
    }

    // Try yt-dlp first
    try {
      const result = await $`yt-dlp "https://www.youtube.com/watch?v=${id}" -f bestaudio --get-url`.text();
      const streamUrl = result.trim();
      if (streamUrl) {
        logger.info({ id, streamUrl }, "yt-dlp successfully resolved stream URL");
        return streamUrl;
      }
    } catch (err) {
      logger.warn({ err, id }, "yt-dlp resolve failed, falling back to Cobalt/Base64");
    }

    // Check if ID is a base64 encoded URL
    try {
      const decoded = Buffer.from(id, "base64").toString("ascii");
      if (decoded.startsWith("http")) {
        return this.resolveWithCobalt(decoded);
      }
    } catch (e) {
      // ignore
    }

    return this.resolveWithCobalt(`https://www.youtube.com/watch?v=${id}`);
  }

  private async resolveWithCobalt(url: string): Promise<string> {
    try {
      logger.info({ url }, "Attempting to resolve stream with Cobalt API");
      const response = await fetch("https://api.cobalt.tools/api/json", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: url,
          isAudioOnly: true,
          audioFormat: "mp3",
          downloadMode: "stream"
        })
      });

      if (!response.ok) {
        throw new Error(`Cobalt API returned status ${response.status}`);
      }

      const data = await response.json() as any;
      if (data && data.url) {
        logger.info("Cobalt API successfully resolved url");
        return data.url;
      }
      throw new Error("Cobalt API did not return a stream URL");
    } catch (err) {
      logger.error({ err, url }, "Failed resolving with Cobalt, returning raw URL as fallback");
      return url;
    }
  }
}

