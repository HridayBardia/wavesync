"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/store/globalStore";

const getWSUrl = () => {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws";
  }
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }
  const hostname = window.location.hostname;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = window.location.port;
  if (port === "3000") {
    return `${protocol}//${hostname}:8080/ws`;
  } else {
    const portSuffix = port ? `:${port}` : "";
    return `${protocol}//${hostname}${portSuffix}/ws`;
  }
};

const BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];
const NTP_COUNT = 20;
const NTP_MIN_READY = 5;
const RESYNC_INTERVAL = 30_000;

interface NTPSample { offset: number; rtt: number; }

function calcOffset(samples: NTPSample[]): { offsetMs: number; rttMs: number } {
  const sorted = [...samples].sort((a, b) => a.rtt - b.rtt);
  const best = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.5)));
  const offsets = best.map((s) => s.offset).sort((a, b) => a - b);
  const median = offsets[Math.floor(offsets.length / 2)];
  const avgRtt = best.reduce((s, x) => s + x.rtt, 0) / best.length;
  return { offsetMs: median, rttMs: avgRtt };
}

export function WebSocketManager({ roomCode, displayName }: { roomCode: string; displayName: string }) {
  const wsRef = useRef<WebSocket | null>(null);
  const samplesRef = useRef<NTPSample[]>([]);
  const attemptRef = useRef(0);
  const isResyncRef = useRef(false); // true when doing background resync (not initial)
  const { setWS, setConnected, updateNTP, applyServerMessage } = useStore();

  function runNTP(ws: WebSocket, isBackground: boolean) {
    samplesRef.current = [];
    isResyncRef.current = isBackground;
    let sent = 0;
    const iv = setInterval(() => {
      if (sent >= NTP_COUNT || ws.readyState !== WebSocket.OPEN) {
        clearInterval(iv);
        return;
      }
      ws.send(JSON.stringify({ type: "NTP_REQUEST", t0: Date.now() }));
      sent++;
    }, 200);
  }

  function connect() {
    let ws: WebSocket;
    const url = getWSUrl();
    try { ws = new WebSocket(url); } catch {
      setTimeout(connect, BACKOFF[Math.min(attemptRef.current++, BACKOFF.length - 1)]);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setConnected(true);
      ws.send(JSON.stringify({ type: "JOIN_ROOM", roomCode, displayName }));
      runNTP(ws, false); // initial sync — not background
    };

    ws.onmessage = (evt) => {
      let msg: any;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === "NTP_RESPONSE") {
        const t3 = Date.now();
        const offset = ((msg.t1 - msg.t0) + (msg.t2 - t3)) / 2;
        const rtt = (t3 - msg.t0) - (msg.t2 - msg.t1);
        samplesRef.current.push({ offset, rtt });

        if (samplesRef.current.length >= NTP_MIN_READY) {
          const { offsetMs, rttMs } = calcOffset(samplesRef.current);
          // ALWAYS call updateNTP — it handles hasSyncedOnce internally
          updateNTP(offsetMs, rttMs, samplesRef.current.length);

          // Report our offset to server
          ws.send(JSON.stringify({ type: "UPDATE_SYNC_OFFSET", offsetMs }));
        }
        return;
      }

      if (msg.type === "PONG") return;

      applyServerMessage(msg);
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, BACKOFF[Math.min(attemptRef.current++, BACKOFF.length - 1)]);
    };

    ws.onerror = () => {}; // onclose fires after onerror

    setWS(ws);
  }

  useEffect(() => {
    connect();

    // Background resync — NEVER resets hasSyncedOnce or shows syncing screen
    const resyncTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        runNTP(wsRef.current, true); // isBackground = true
      }
    }, RESYNC_INTERVAL);

    // Heartbeat
    const pingTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "PING", t: Date.now() }));
      }
    }, 15_000);

    return () => {
      clearInterval(resyncTimer);
      clearInterval(pingTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect loop
        wsRef.current.close();
      }
    };
  }, []);

  return null;
}
export default WebSocketManager;
