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
  const { hasSyncedOnce, gestureUnlocked, setRoomInfo } = useStore();

  useEffect(() => {
    const name = sessionStorage.getItem("ws_display_name")
      || "Guest-" + Math.random().toString(36).substring(2, 5).toUpperCase();
    setDisplayName(name);
    setRoomInfo(roomCode, name);
  }, [roomCode, setRoomInfo]);

  if (!displayName) return null;

  // Show syncing screen ONLY until hasSyncedOnce — never again
  if (!hasSyncedOnce) {
    return (
      <>
        <WebSocketManager roomCode={roomCode} displayName={displayName} />
        <NTPSyncScreen roomCode={roomCode} />
      </>
    );
  }

  // Show audio gate ONLY until gesture — stored in Zustand, survives re-renders
  if (!gestureUnlocked) {
    return (
      <>
        <WebSocketManager roomCode={roomCode} displayName={displayName} />
        <AudioGateScreen />
      </>
    );
  }

  // Full dashboard — never unmounts due to NTP re-sync
  return (
    <>
      <WebSocketManager roomCode={roomCode} displayName={displayName} />
      <RoomDashboard roomCode={roomCode} />
    </>
  );
}
export default RoomShell;
