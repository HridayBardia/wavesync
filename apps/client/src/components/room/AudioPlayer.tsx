"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/store/globalStore";
import { ytPlayerEngine } from "@/utils/youtubePlayer";

const STALE_MS = 5000;

export function AudioPlayer() {
  const { pendingCommand, ntpOffsetMs, clearPendingCommand, currentTrack, hasSyncedOnce } = useStore();
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    // Initialize YouTube Player
    ytPlayerEngine.init("youtube-player-container");

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pendingCommand) return;
    if (!hasSyncedOnce) {
      console.log("[AudioPlayer] Deferring command execution until NTP sync completes");
      return;
    }

    const cmd = pendingCommand;
    clearPendingCommand();

    const delayMs = (cmd.serverExecuteAtMs - ntpOffsetMs) - Date.now();
    if (delayMs < -STALE_MS) {
      console.warn("[AudioPlayer] Stale command, dropping:", cmd.type, `${delayMs}ms late`);
      return;
    }

    const youtubeId = currentTrack?.youtubeId || (currentTrack?.audioUrl ? currentTrack.audioUrl.split("/").pop() : null);
    if (!youtubeId) {
      console.warn("[AudioPlayer] No YouTube ID available for command:", cmd.type);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (cmd.type === "SCHEDULED_PLAY") {
      const startFromMs = cmd.startFromMs ?? 0;
      if (delayMs > 0) {
        timeoutRef.current = setTimeout(() => {
          ytPlayerEngine.loadAndPlay(youtubeId, startFromMs / 1000, true);
        }, delayMs);
      } else {
        const catchUpSec = (startFromMs - delayMs) / 1000;
        ytPlayerEngine.loadAndPlay(youtubeId, catchUpSec, true);
      }

    } else if (cmd.type === "SCHEDULED_PAUSE") {
      if (delayMs > 0) {
        timeoutRef.current = setTimeout(() => {
          ytPlayerEngine.pause();
        }, delayMs);
      } else {
        ytPlayerEngine.pause();
      }

    } else if (cmd.type === "SCHEDULED_SEEK") {
      const positionMs = cmd.positionMs ?? 0;
      if (delayMs > 0) {
        timeoutRef.current = setTimeout(() => {
          ytPlayerEngine.seekTo(positionMs / 1000);
        }, delayMs);
      } else {
        const catchUpSec = (positionMs - delayMs) / 1000;
        ytPlayerEngine.seekTo(catchUpSec);
      }
    }

  }, [pendingCommand, hasSyncedOnce, currentTrack, ntpOffsetMs]);

  // Load track when currentTrack changes (preload / pre-cue)
  useEffect(() => {
    if (currentTrack) {
      const youtubeId = currentTrack.youtubeId || (currentTrack.audioUrl ? currentTrack.audioUrl.split("/").pop() : null);
      if (youtubeId) {
        ytPlayerEngine.loadAndPlay(youtubeId, 0, false);
      }
    }
  }, [currentTrack?.id]);

  return (
    <div 
      style={{
        position: "absolute",
        left: "-9999px",
        top: "-9999px",
        width: "1px",
        height: "1px",
        opacity: 0,
        pointerEvents: "none"
      }}
    >
      <div id="youtube-player-container" />
    </div>
  );
}

export default AudioPlayer;
