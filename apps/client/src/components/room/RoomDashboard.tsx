"use client";
import { useEffect, useState } from "react";
import AudioPlayer from "./AudioPlayer";
import { SearchBar } from "./SearchBar";
import WaveformVisualizer from "./WaveformVisualizer";
import { useGlobalStore } from "@/store/globalStore";
import { audioEngine } from "@/utils/audio";
import { 
  Play, 
  Pause, 
  SkipForward, 
  Users, 
  Music, 
  Volume2, 
  VolumeX, 
  ArrowLeft
} from "lucide-react";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function RoomDashboard({ roomCode }: { roomCode: string }) {
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [position, setPosition] = useState(0);

  const {
    connected,
    syncQuality,
    ntpOffsetMs,
    currentTrack,
    queue,
    isPlaying,
    connectedUsers,
    sendCommand,
    serverPositionMs,
    lastServerTimeMs,
  } = useGlobalStore();

  // Playback timeline position tracking
  useEffect(() => {
    if (!isPlaying || !currentTrack) {
      setPosition(serverPositionMs);
      return;
    }

    const updateInterval = setInterval(() => {
      const serverNow = Date.now() + ntpOffsetMs;
      const elapsed = serverNow - lastServerTimeMs;
      const currentPos = Math.max(0, Math.min(currentTrack.durationMs, serverPositionMs + elapsed));
      setPosition(isNaN(currentPos) ? 0 : currentPos);
    }, 100);

    return () => clearInterval(updateInterval);
  }, [isPlaying, currentTrack, serverPositionMs, lastServerTimeMs, ntpOffsetMs]);

  const handlePlayToggle = () => {
    sendCommand({ type: isPlaying ? "PAUSE" : "PLAY" });
  };

  const handleSkip = () => {
    sendCommand({ type: "SKIP" });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setPosition(value);
    sendCommand({ type: "SEEK", positionMs: value });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val === 0) {
      setMuted(true);
    } else {
      setMuted(false);
      audioEngine.setVolume(val);
    }
  };

  const toggleMute = () => {
    if (muted) {
      setMuted(false);
      audioEngine.setVolume(volume);
    } else {
      setMuted(true);
      audioEngine.setVolume(0);
    }
  };

  const syncColor =
    syncQuality === "good"
      ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
      : syncQuality === "fair"
      ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
      : "text-rose-400 bg-rose-500/10 border border-rose-500/20";

  const syncDot =
    syncQuality === "good" ? "🟢" : syncQuality === "fair" ? "🟡" : "🔴";

  return (
    <div className="min-h-screen bg-[#030014] text-white relative">
      <AudioPlayer />
      <div className="ambient-glow"></div>

      {/* Header */}
      <header className="z-10 relative border-b border-slate-800 bg-slate-950/40 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/" className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </a>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              WaveSync <span className="text-brand font-mono">#{roomCode}</span>
            </h1>
            <p className="text-xs text-slate-400">Collaborative Audio Room</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${syncColor}`}>
            {syncDot} {syncQuality === "syncing" ? "Syncing…" : syncQuality === "good" ? "Synced" : `±${Math.round(ntpOffsetMs)}ms`}
          </span>
          <span className="text-xs text-slate-500 font-mono hidden md:inline">
            Status: {connected ? "Connected" : "Reconnecting..."}
          </span>
        </div>
      </header>

      {/* Main Room Layout Grid */}
      <div className="z-10 relative flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl w-full mx-auto">
        
        {/* Left Columns - Music Player & Controls */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Main Player Display */}
          <div className="glass-panel p-6 flex flex-col gap-6 border-brand/10">
            {currentTrack ? (
              <div className="flex flex-col md:flex-row gap-6 items-center">
                {/* Album Cover Art */}
                <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shadow-xl shrink-0">
                  {currentTrack.thumbnailUrl ? (
                    <img 
                      src={currentTrack.thumbnailUrl} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-900">
                      <Music size={48} />
                    </div>
                  )}
                </div>

                {/* Info & Player Progress */}
                <div className="flex-1 w-full flex flex-col gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white leading-tight line-clamp-1">{currentTrack.title}</h2>
                    <p className="text-slate-400 text-sm">{currentTrack.artist || "Unknown Artist"}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700 capitalize font-mono">
                      Source: {currentTrack.source} • Added by {currentTrack.addedBy}
                    </span>
                  </div>

                  {/* Progress Seek Slider */}
                  <div className="flex flex-col gap-2">
                    <input
                      type="range"
                      min="0"
                      max={currentTrack.durationMs}
                      value={position}
                      onChange={handleSeek}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand"
                    />
                    <div className="flex justify-between text-xs font-mono text-slate-500">
                      <span>{formatDuration(position)}</span>
                      <span>{formatDuration(currentTrack.durationMs)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                  <Music size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-400">No Song Currently Playing</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Search for a song below to initialize playback across all synced devices.
                </p>
              </div>
            )}

            {/* Playback Oscilloscope Visualizer */}
            <WaveformVisualizer />

            {/* Controls Row */}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 gap-4">
              {/* Volume Controls */}
              <div className="flex items-center gap-3 bg-slate-900/40 px-4 py-2 rounded-xl border border-slate-800">
                <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors">
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-20 md:w-24 accent-brand cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none"
                />
              </div>

              {/* Playback Control Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePlayToggle}
                  disabled={!currentTrack}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                    currentTrack 
                      ? "bg-white text-slate-950 hover:scale-105 cursor-pointer" 
                      : "bg-slate-800 text-slate-600 cursor-not-allowed"
                  }`}
                >
                  {isPlaying ? <Pause size={20} className="fill-current text-slate-950" /> : <Play size={20} className="fill-current ml-0.5 text-slate-950" />}
                </button>
                
                <button
                  onClick={handleSkip}
                  disabled={queue.length === 0 && !currentTrack}
                  className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SkipForward size={18} />
                </button>
              </div>

              <div className="w-20 hidden md:block"></div> {/* Spacer for symmetry */}
            </div>
          </div>

          {/* Search Section */}
          <div className="glass-panel p-6 flex flex-col gap-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Search Tracks</h3>
            <SearchBar />
          </div>
        </div>

        {/* Right Column - Queue & Users */}
        <div className="flex flex-col gap-6">
          
          {/* Cooperative Queue Card */}
          <div className="glass-panel p-6 flex flex-col gap-4 border-slate-800">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Music size={16} />
              Up Next ({queue.length})
            </h3>
            
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[300px] pr-1">
              {queue.length > 0 ? (
                queue.map((track, i) => (
                  <div 
                    key={track.id + "-" + i} 
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-900/30 border border-slate-800/60 hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className="text-xs font-mono text-slate-600 font-bold w-4 shrink-0">{i + 1}</span>
                      {track.thumbnailUrl && (
                        <img 
                          src={track.thumbnailUrl} 
                          alt={track.title} 
                          className="w-8 h-8 object-cover rounded-lg shrink-0"
                        />
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-white line-clamp-1 leading-tight">{track.title}</p>
                        <p className="text-[10px] text-slate-500">{track.artist}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 ml-2 shrink-0">{formatDuration(track.durationMs)}</span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <Music size={24} className="text-slate-700 animate-pulse" />
                  <span>Queue is empty</span>
                </div>
              )}
            </div>
          </div>

          {/* Connected Listeners Card */}
          <div className="glass-panel p-6 flex flex-col gap-4 border-slate-800">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Users size={16} />
              Synced Listeners ({connectedUsers.length})
            </h3>

            <div className="flex flex-col gap-3 overflow-y-auto max-h-[220px]">
              {connectedUsers.map((user) => (
                <div 
                  key={user.id} 
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center font-bold text-xs text-brand uppercase">
                      {user.displayName.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{user.displayName}</p>
                      <p className="text-[10px] text-slate-500 font-mono">Offset: {user.syncOffsetMs.toFixed(1)}ms</p>
                    </div>
                  </div>

                  <span className={`w-2.5 h-2.5 rounded-full ${
                    user.syncQuality === "good" 
                      ? "bg-emerald-400" 
                      : user.syncQuality === "fair" 
                      ? "bg-amber-400" 
                      : "bg-rose-500 animate-pulse"
                  }`} title={`Sync quality: ${user.syncQuality}`}></span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
