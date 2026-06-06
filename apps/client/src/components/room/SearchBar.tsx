"use client";
import { useState } from "react";
import { useStore } from "@/store/globalStore";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const { sendWS, setToastError } = useStore();

  async function search() {
    console.log("[SearchBar] API URL:", API);
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      if ((data.results ?? []).length === 0) setToastError("No results found");
    } catch {
      setToastError("Search failed — check server connection");
    }
    setLoading(false);
  }

  async function addTrack(track: any) {
    setAddingId(track.id);
    try {
      // THE KEY FIX: audioUrl points to OUR server proxy, not YouTube directly
      const audioUrl = `${API}/stream/${track.id}`;

      // Verify the stream is actually reachable before adding
      const check = await fetch(`${API}/stream/${track.id}`, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      });

      if (!check.ok && check.status !== 206) {
        throw new Error(`Stream unavailable (${check.status})`);
      }

      const fullTrack = {
        id: crypto.randomUUID(),
        youtubeId: track.id,
        title: track.title,
        artist: track.artist,
        durationMs: track.durationMs,
        thumbnailUrl: track.thumbnailUrl,
        audioUrl, // http://localhost:8080/stream/<videoId>
        source: "youtube",
        addedBy: useStore.getState().displayName || "Guest",
      };

      sendWS({ type: "ADD_TO_QUEUE", track: fullTrack });
      setResults([]);
      setQuery("");
    } catch (e) {
      setToastError(`Could not load "${track.title}" — try another result`);
    }
    setAddingId(null);
  }

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        <input
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 transition"
          placeholder="Search any song, artist… (powered by YouTube)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-3 rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : "🔍"} Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-white/10 rounded-xl overflow-hidden z-50 max-h-72 overflow-y-auto shadow-2xl">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => addTrack(r)}
              disabled={addingId === r.id}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition border-b border-white/5 last:border-0 disabled:opacity-60"
            >
              {r.thumbnailUrl && (
                <img src={r.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{r.title}</p>
                <p className="text-white/40 text-xs truncate">{r.artist}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-white/30 text-xs">
                  {Math.floor((r.durationMs ?? 0) / 60000)}:{String(Math.floor(((r.durationMs ?? 0) % 60000) / 1000)).padStart(2, "0")}
                </span>
                <div className="w-8 h-8 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center text-white text-sm transition">
                  {addingId === r.id
                    ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : "+"}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export default SearchBar;
