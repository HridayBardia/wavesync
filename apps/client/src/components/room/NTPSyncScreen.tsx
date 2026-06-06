"use client";
import { useGlobalStore } from "@/store/globalStore";

export function NTPSyncScreen({ roomCode }: { roomCode: string }) {
  const { ntpSamples, connected } = useGlobalStore();
  const progress = Math.min(100, Math.round((ntpSamples / 20) * 100));

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-sm px-6">
        <div className="text-5xl">🎵</div>
        <h2 className="text-white text-2xl font-bold">Syncing your device</h2>
        <p className="text-white/40 text-sm">
          {connected
            ? `Calibrating clock with server… ${ntpSamples}/20 samples`
            : "Connecting to server…"}
        </p>
        <div className="w-full bg-white/10 rounded-full h-2">
          <div
            className="bg-violet-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/20 text-xs font-mono">Room: {roomCode}</p>
      </div>
    </div>
  );
}
