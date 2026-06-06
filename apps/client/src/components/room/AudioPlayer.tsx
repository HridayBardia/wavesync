"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/store/globalStore";
import { audioEngine } from "@/utils/audio";

const STALE_MS = 3000;

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { pendingCommand, ntpOffsetMs, clearPendingCommand, currentTrack } = useStore();

  function getCtx(): AudioContext {
    audioEngine.init();
    const ctx = audioEngine.getContext()!;
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      audioRef.current.preload = "auto";
    }
    return audioRef.current;
  }

  function connectAudio(audio: HTMLAudioElement) {
    audioEngine.connectMediaElement(audio);
  }

  function serverToLocalAudioCtxTime(serverMs: number): number {
    const ctx = getCtx();
    const localMs = serverMs - ntpOffsetMs;
    const msUntil = localMs - Date.now();
    return ctx.currentTime + msUntil / 1000;
  }

  useEffect(() => {
    if (!pendingCommand) return;
    const cmd = pendingCommand;
    clearPendingCommand();

    const msUntilExec = (cmd.serverExecuteAtMs - ntpOffsetMs) - Date.now();
    if (msUntilExec < -STALE_MS) {
      console.warn("[AudioPlayer] Stale command, dropping:", cmd.type, `${msUntilExec}ms late`);
      return;
    }

    const audio = getAudio();

    if (cmd.type === "SCHEDULED_PLAY") {
      // Load new track if needed
      const newUrl = cmd.trackUrl;
      if (audio.src !== newUrl) {
        audio.src = newUrl;
        audio.load();
      }

      connectAudio(audio);
      const ctx = getCtx();

      const scheduleAt = Math.max(ctx.currentTime + 0.05, serverToLocalAudioCtxTime(cmd.serverExecuteAtMs));
      const startFrom = (cmd.startFromMs ?? 0) / 1000;

      // Wait for enough data, then schedule
      const doPlay = () => {
        audio.currentTime = startFrom;
        const delay = (scheduleAt - ctx.currentTime) * 1000;
        if (delay > 0) {
          setTimeout(() => {
            audio.play().catch((e) => console.error("[AudioPlayer] play() failed:", e));
          }, delay);
        } else {
          audio.play().catch((e) => console.error("[AudioPlayer] play() failed:", e));
        }
      };

      if (audio.readyState >= 3) { // HAVE_FUTURE_DATA
        doPlay();
      } else {
        audio.addEventListener("canplay", doPlay, { once: true });
      }

    } else if (cmd.type === "SCHEDULED_PAUSE") {
      const ctx = getCtx();
      const scheduleAt = serverToLocalAudioCtxTime(cmd.serverExecuteAtMs);
      const delay = Math.max(0, (scheduleAt - ctx.currentTime) * 1000);
      setTimeout(() => audio.pause(), delay);

    } else if (cmd.type === "SCHEDULED_SEEK") {
      const ctx = getCtx();
      const scheduleAt = serverToLocalAudioCtxTime(cmd.serverExecuteAtMs);
      const delay = Math.max(0, (scheduleAt - ctx.currentTime) * 1000);
      setTimeout(() => {
        audio.currentTime = (cmd.positionMs ?? 0) / 1000;
        if (!audio.paused) audio.play().catch(() => {});
      }, delay);
    }

  }, [pendingCommand]);

  // Load track when currentTrack changes (preload)
  useEffect(() => {
    if (currentTrack?.audioUrl) {
      const audio = getAudio();
      if (audio.src !== currentTrack.audioUrl) {
        audio.src = currentTrack.audioUrl;
        audio.load(); // start preloading
      }
    }
  }, [currentTrack?.audioUrl]);

  return null; // invisible — audio is handled via Web Audio API
}
export default AudioPlayer;
