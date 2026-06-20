"use client";
import { useStore } from "@/store/globalStore";
import { audioEngine } from "@/utils/audio";

export function AudioGateScreen() {
  const setGestureUnlocked = useStore((s) => s.setGestureUnlocked);

  function handleUnlock() {
    // Create and resume AudioContext to satisfy browser gesture requirement
    try {
      audioEngine.init();
      const ctx = audioEngine.getContext();
      ctx?.resume();
      
      // Play and pause a tiny silent duration to unlock HTMLAudioElement for iOS Safari
      const audio = audioEngine.getAudioElement();
      audio.play().then(() => {
        audio.pause();
      }).catch((e) => {
        console.warn("[AudioEngine] failed to unlock audio element:", e);
      });
    } catch {}
    setGestureUnlocked(); // stored in Zustand — survives re-renders
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="bg-[#12121a] border border-white/10 rounded-2xl p-10 text-center max-w-sm space-y-6">
        <div className="w-16 h-16 bg-violet-600/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
          <span className="text-3xl">🔊</span>
        </div>
        <h2 className="text-white text-2xl font-bold">Connect Audio</h2>
        <p className="text-white/50 text-sm">Tap to unlock synchronized audio playback on this device.</p>
        <button
          onClick={handleUnlock}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl transition transform hover:scale-105 active:scale-95 duration-200 cursor-pointer shadow-lg shadow-violet-600/30"
        >
          🎵 Tap to Join Audio
        </button>
      </div>
    </div>
  );
}
export default AudioGateScreen;
