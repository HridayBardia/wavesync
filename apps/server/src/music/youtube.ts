const YT_API_KEY = process.env.YOUTUBE_API_KEY ?? "";
const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export interface TrackResult {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  thumbnailUrl: string;
}

export async function searchTracks(query: string): Promise<TrackResult[]> {
  if (!YT_API_KEY) throw new Error("YOUTUBE_API_KEY not set in .env");

  // Search for videos
  const searchRes = await fetch(
    `${YT_SEARCH_URL}?part=snippet&type=video&videoCategoryId=10&maxResults=15&q=${encodeURIComponent(query)}&key=${YT_API_KEY}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!searchRes.ok) throw new Error(`YouTube search failed: ${searchRes.status}`);
  const searchData = await searchRes.json();

  if (!searchData.items?.length) return [];

  const videoIds = searchData.items.map((item: any) => item.id?.videoId).filter(Boolean).join(",");

  // Get durations via videos endpoint
  const videoRes = await fetch(
    `${YT_VIDEOS_URL}?part=contentDetails,snippet&id=${videoIds}&key=${YT_API_KEY}`,
    { signal: AbortSignal.timeout(8000) }
  );
  const videoData = videoRes.ok ? await videoRes.json() : { items: [] };

  const durationMap: Record<string, number> = {};
  for (const v of videoData.items ?? []) {
    const iso = v.contentDetails?.duration ?? "";
    durationMap[v.id] = parseISO8601Duration(iso);
  }

  return searchData.items
    .map((item: any) => {
      const id = item.id?.videoId ?? "";
      const snippet = item.snippet ?? {};
      return {
        id,
        title: snippet.title ?? "Unknown",
        artist: snippet.channelTitle ?? "",
        durationMs: durationMap[id] ?? 0,
        thumbnailUrl:
          snippet.thumbnails?.medium?.url ??
          snippet.thumbnails?.default?.url ??
          `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      };
    })
    .filter((t: TrackResult) => t.id.length > 0);
}

function parseISO8601Duration(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const h = parseInt(match[1] ?? "0");
  const m = parseInt(match[2] ?? "0");
  const s = parseInt(match[3] ?? "0");
  return (h * 3600 + m * 60 + s) * 1000;
}

// Cache to avoid hitting yt-dlp repeatedly for the same video
const streamCache = new Map<string, { url: string; expiry: number }>();

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.smnz.de",
  "https://pipedapi.garudalinux.org",
  "https://pipedapi.in.projectsegfau.lt",
  "https://pipedapi.moomoo.me",
];

export async function getAudioStreamUrl(videoId: string): Promise<string> {
  const cached = streamCache.get(videoId);
  if (cached && cached.expiry > Date.now()) return cached.url;

  let lastError: any = null;

  for (const baseUrl of PIPED_INSTANCES) {
    try {
      // Use a public Piped API instance to get the stream URL (bypasses YouTube datacenter blocks)
      const pipedRes = await fetch(`${baseUrl}/streams/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(6000), // 6 second timeout per instance
      });

      if (!pipedRes.ok) {
        throw new Error(`Piped API failed: ${pipedRes.status}`);
      }

      const data = await pipedRes.json();
      const audioStreams = data.audioStreams ?? [];
      
      if (audioStreams.length === 0) {
        throw new Error(`No audio streams found`);
      }

      // Get highest bitrate audio stream
      const stream = audioStreams.sort((a: any, b: any) => b.bitrate - a.bitrate)[0];
      const url = stream.url;

      if (!url) {
        throw new Error(`Could not extract stream URL`);
      }

      // Cache for 4 hours
      streamCache.set(videoId, { url, expiry: Date.now() + 4 * 3600_000 });
      return url;
    } catch (e) {
      lastError = e;
      console.warn(`[Stream] Piped instance ${baseUrl} failed:`, String(e));
      continue; // Try next instance
    }
  }

  throw new Error(`All Piped API instances failed. Last error: ${lastError}`);
}
