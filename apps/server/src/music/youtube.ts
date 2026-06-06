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


