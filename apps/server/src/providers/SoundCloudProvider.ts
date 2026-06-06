import { MusicProvider, SearchResult } from "./MusicProvider";
import { logger } from "../utils/logger";

export class SoundCloudProvider implements MusicProvider {
  private static mockTracks: SearchResult[] = [
    {
      id: "sc-1",
      title: "Chill Acoustic Sessions",
      artist: "Acoustic Waves",
      durationMs: 302000,
      thumbnailUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300",
      streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      source: "soundcloud",
    },
    {
      id: "sc-2",
      title: "Deep House Midnight Mix",
      artist: "DJ Shadow",
      durationMs: 300000,
      thumbnailUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=300",
      streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      source: "soundcloud",
    }
  ];

  async search(query: string): Promise<SearchResult[]> {
    logger.info({ query }, "SoundCloud search query received");
    
    // If it looks like a URL, wrap it in a SearchResult
    if (query.startsWith("http://") || query.startsWith("https://")) {
      return [
        {
          id: Buffer.from(query).toString("base64"),
          title: "SoundCloud URL Playback",
          artist: "Direct Link",
          durationMs: 300000,
          thumbnailUrl: "https://images.unsplash.com/photo-1614680376593-902f74fa0d41?w=300",
          streamUrl: query,
          source: "soundcloud",
        }
      ];
    }

    const q = query.toLowerCase();
    const results = SoundCloudProvider.mockTracks.filter(
      t => t.title.toLowerCase().includes(q) || t.artist?.toLowerCase().includes(q)
    );

    return results.length > 0 ? results : SoundCloudProvider.mockTracks;
  }

  async getStreamUrl(id: string): Promise<string> {
    logger.info({ id }, "SoundCloud getStreamUrl received");

    try {
      const decoded = Buffer.from(id, "base64").toString("ascii");
      if (decoded.startsWith("http")) {
        return this.resolveWithCobalt(decoded);
      }
    } catch (e) {
      // ignore
    }

    const mockTrack = SoundCloudProvider.mockTracks.find(t => t.id === id);
    if (mockTrack) {
      return mockTrack.streamUrl;
    }

    throw new Error("Track not found");
  }

  private async resolveWithCobalt(url: string): Promise<string> {
    try {
      logger.info({ url }, "Attempting to resolve SoundCloud stream with Cobalt API");
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
        logger.info("Cobalt API successfully resolved SoundCloud url");
        return data.url;
      }
      throw new Error("Cobalt API did not return a stream URL");
    } catch (err) {
      logger.error({ err, url }, "Failed resolving with Cobalt, returning raw URL as fallback");
      return url;
    }
  }
}
