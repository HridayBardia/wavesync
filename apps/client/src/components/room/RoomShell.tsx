"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/store/globalStore";
import { WebSocketManager } from "./WebSocketManager";
import { NTPSyncScreen } from "./NTPSyncScreen";
import { AudioGateScreen } from "./AudioGateScreen";
import { RoomDashboard } from "./RoomDashboard";
import { audioEngine } from "@/utils/audio";

export function RoomShell({ roomCode }: { roomCode: string }) {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const { setRoomInfo } = useStore();

  useEffect(() => {
    const name = sessionStorage.getItem("ws_display_name")
      || "Guest-" + Math.random().toString(36).substring(2, 5).toUpperCase();
    setDisplayName(name);
    setRoomInfo(roomCode, name);

    // Auto-unlock AudioContext and HTMLAudioElement on first tap/click
    const unlock = () => {
      try {
        audioEngine.init();
        audioEngine.getContext()?.resume();
        
        // Play and pause a tiny silent duration to unlock HTMLAudioElement for iOS Safari
        const audio = audioEngine.getAudioElement();
        audio.play().then(() => {
          audio.pause();
        }).catch((e) => {
          console.warn("[AudioEngine] failed to unlock audio element:", e);
        });
      } catch {}
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("click", unlock);
    window.addEventListener("touchstart", unlock);

    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, [roomCode, setRoomInfo]);

  if (!displayName) return null;

  return (
    <>
      <WebSocketManager roomCode={roomCode} displayName={displayName} />
      <RoomDashboard roomCode={roomCode} />
    </>
  );
}
export default RoomShell;
