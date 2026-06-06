export interface SearchResult {
  id: string;
  title: string;
  artist?: string;
  durationMs: number;
  thumbnailUrl?: string;
  streamUrl: string;  // direct audio URL
  source: "youtube" | "soundcloud" | "upload" | "spotify";
}

export interface MusicProvider {
  search(query: string): Promise<SearchResult[]>;
  getStreamUrl(id: string): Promise<string>;
}
