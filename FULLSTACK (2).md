# FULLSTACK.md — WaveSync
## Complete Fullstack Implementation Specification

**Stack:** TypeScript everywhere • Bun runtime • Next.js 15 • Tailwind CSS v4 • Shadcn/ui • Zustand • Zod • Cloudflare R2 • WebSockets • Web Audio API  
**Monorepo:** Turborepo + Bun workspaces  
**Deployment:** Vercel (client) + Fly.io or Railway (server) + Cloudflare R2 (audio)

---

## 1. Repository Structure

```
wavesync/
├── apps/
│   ├── client/                  # Next.js 15 App Router frontend
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx               # Landing / room join
│   │   │   │   └── room/[code]/
│   │   │   │       └── page.tsx           # Room dashboard
│   │   │   ├── components/
│   │   │   │   ├── room/
│   │   │   │   │   ├── WebSocketManager.tsx
│   │   │   │   │   ├── AudioPlayer.tsx
│   │   │   │   │   ├── NTPSyncProgress.tsx
│   │   │   │   │   ├── Queue.tsx
│   │   │   │   │   ├── SearchBar.tsx
│   │   │   │   │   ├── ConnectedUsers.tsx
│   │   │   │   │   ├── SyncBadge.tsx
│   │   │   │   │   ├── SpatialGrid.tsx
│   │   │   │   │   └── WaveformVisualizer.tsx
│   │   │   │   └── ui/                    # Shadcn components
│   │   │   ├── hooks/
│   │   │   │   ├── useAudioContext.ts
│   │   │   │   ├── useNTP.ts
│   │   │   │   └── useWebSocket.ts
│   │   │   ├── store/
│   │   │   │   └── globalStore.ts         # Zustand global state
│   │   │   └── utils/
│   │   │       ├── ntp.ts
│   │   │       ├── audio.ts
│   │   │       └── constants.ts
│   │   ├── public/
│   │   ├── .env.local
│   │   └── package.json
│   │
│   └── server/                  # Bun HTTP + WebSocket server
│       ├── src/
│       │   ├── index.ts               # Entry point
│       │   ├── router.ts              # HTTP routes
│       │   ├── ws/
│       │   │   ├── handler.ts         # WebSocket message handler
│       │   │   └── ntpHandler.ts      # NTP message processing
│       │   ├── rooms/
│       │   │   ├── RoomManager.ts     # Room lifecycle
│       │   │   └── RoomInstance.ts    # Per-room state
│       │   ├── providers/
│       │   │   ├── MusicProvider.ts   # Interface
│       │   │   ├── UploadProvider.ts
│       │   │   ├── YouTubeProvider.ts
│       │   │   └── SoundCloudProvider.ts
│       │   ├── storage/
│       │   │   └── r2.ts              # Cloudflare R2 client
│       │   └── utils/
│       │       ├── logger.ts          # Pino logger
│       │       └── rateLimit.ts
│       ├── .env
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── schemas.ts       # Zod schemas for all WS messages
│       │   ├── types.ts         # Shared TypeScript types
│       │   └── constants.ts     # All timing/config constants
│       └── package.json
│
├── Dockerfile
├── docker-compose.yml
├── turbo.json
├── package.json (root)
└── bun.lock
```

---

## 2. Shared Package (`packages/shared`)

### 2.1 Constants (`constants.ts`)

```typescript
export const NTP_SAMPLE_COUNT = 40;           // Total NTP samples to collect
export const NTP_MIN_SAMPLES = 20;            // Min before sync is "ready"
export const NTP_FILTER_PERCENTILE = 0.5;     // Use bottom 50% by RTT
export const SCHEDULE_AHEAD_MS = 400;         // Audio lookahead buffer
export const STALE_COMMAND_THRESHOLD_MS = 2000; // Drop commands older than this
export const HEARTBEAT_INTERVAL_MS = 15000;   // Server ping interval
export const HEARTBEAT_TIMEOUT_MS = 5000;     // Pong must arrive within
export const RESYNC_INTERVAL_MS = 30000;      // Background resync
export const RESYNC_DRIFT_THRESHOLD_MS = 15;  // Force resync if drift > this
export const RECONNECT_BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];
export const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024; // 200MB
export const SIGNED_URL_EXPIRY_SECONDS = 4 * 60 * 60;  // 4 hours
```

### 2.2 WebSocket Message Schemas (`schemas.ts`)

```typescript
import { z } from "zod";

// ─── CLIENT → SERVER ───────────────────────────────────────────

export const JoinRoomMsg = z.object({
  type: z.literal("JOIN_ROOM"),
  roomCode: z.string().min(3).max(20),
  displayName: z.string().min(1).max(30),
});

export const NTPRequestMsg = z.object({
  type: z.literal("NTP_REQUEST"),
  t0: z.number(),  // client send time
});

export const PlayMsg = z.object({
  type: z.literal("PLAY"),
  roomCode: z.string(),
});

export const PauseMsg = z.object({
  type: z.literal("PAUSE"),
  roomCode: z.string(),
});

export const SeekMsg = z.object({
  type: z.literal("SEEK"),
  roomCode: z.string(),
  positionMs: z.number().min(0),
});

export const SkipMsg = z.object({
  type: z.literal("SKIP"),
  roomCode: z.string(),
});

export const AddToQueueMsg = z.object({
  type: z.literal("ADD_TO_QUEUE"),
  roomCode: z.string(),
  track: TrackSchema,
});

export const PongMsg = z.object({
  type: z.literal("PONG"),
});

// ─── SERVER → CLIENT ───────────────────────────────────────────

export const NTPResponseMsg = z.object({
  type: z.literal("NTP_RESPONSE"),
  t0: z.number(),   // echoed from client
  t1: z.number(),   // server receive time
  t2: z.number(),   // server send time
});

export const RoomStateMsg = z.object({
  type: z.literal("ROOM_STATE"),
  roomCode: z.string(),
  connectedUsers: z.array(UserSchema),
  currentTrack: TrackSchema.nullable(),
  queue: z.array(TrackSchema),
  isPlaying: z.boolean(),
  serverPositionMs: z.number(),
  serverTimeMs: z.number(),  // server's current time when this was sent
});

export const ScheduledPlayMsg = z.object({
  type: z.literal("SCHEDULED_PLAY"),
  serverExecuteAtMs: z.number(),  // absolute server time to start playing
  trackUrl: z.string().url(),
  startFromMs: z.number(),        // offset into track
});

export const ScheduledPauseMsg = z.object({
  type: z.literal("SCHEDULED_PAUSE"),
  serverExecuteAtMs: z.number(),
});

export const ScheduledSeekMsg = z.object({
  type: z.literal("SCHEDULED_SEEK"),
  serverExecuteAtMs: z.number(),
  positionMs: z.number(),
});

export const QueueUpdateMsg = z.object({
  type: z.literal("QUEUE_UPDATE"),
  queue: z.array(TrackSchema),
});

export const UserJoinedMsg = z.object({
  type: z.literal("USER_JOINED"),
  user: UserSchema,
});

export const UserLeftMsg = z.object({
  type: z.literal("USER_LEFT"),
  userId: z.string(),
});

export const PingMsg = z.object({
  type: z.literal("PING"),
  serverTimeMs: z.number(),
});

export const ErrorMsg = z.object({
  type: z.literal("ERROR"),
  code: z.string(),
  message: z.string(),
});

// ─── DOMAIN SCHEMAS ────────────────────────────────────────────

export const TrackSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artist: z.string().optional(),
  durationMs: z.number(),
  audioUrl: z.string().url(),   // signed R2 URL or CDN URL
  thumbnailUrl: z.string().url().optional(),
  source: z.enum(["upload", "youtube", "soundcloud", "spotify"]),
  addedBy: z.string(),          // display name
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  syncOffsetMs: z.number(),    // their measured clock offset
  syncQuality: z.enum(["good", "fair", "poor"]),
  spatialX: z.number().optional(),
  spatialY: z.number().optional(),
});

export type Track = z.infer<typeof TrackSchema>;
export type User = z.infer<typeof UserSchema>;
```

---

## 3. Server (`apps/server`)

### 3.1 Entry Point (`index.ts`)

```typescript
import { RoomManager } from "./rooms/RoomManager";
import { handleWebSocket } from "./ws/handler";
import { router } from "./router";
import { logger } from "./utils/logger";
import { validateEnv } from "./utils/env";

validateEnv(); // Zod-validate all env vars at startup — crash if missing

const roomManager = new RoomManager();

const server = Bun.serve({
  port: parseInt(process.env.PORT ?? "8080"),
  fetch(req, server) {
    const url = new URL(req.url);

    // WebSocket upgrade
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, { data: { roomManager } });
      if (!upgraded) return new Response("WebSocket upgrade failed", { status: 400 });
      return undefined;
    }

    // HTTP routes
    return router(req, roomManager);
  },
  websocket: {
    open: (ws) => handleWebSocket.open(ws),
    message: (ws, msg) => handleWebSocket.message(ws, msg, roomManager),
    close: (ws, code, reason) => handleWebSocket.close(ws, code, reason, roomManager),
  },
  error(err) {
    logger.error({ err }, "Server error");
    return new Response("Internal Server Error", { status: 500 });
  },
});

logger.info(`WaveSync server running on port ${server.port}`);

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — shutting down gracefully");
  roomManager.broadcastAll({ type: "SERVER_SHUTDOWN", message: "Server restarting soon" });
  await Bun.sleep(3000);
  process.exit(0);
});
```

### 3.2 Room Instance (`RoomInstance.ts`)

```typescript
import { Track, User } from "@wavesync/shared";
import { HEARTBEAT_INTERVAL_MS, SCHEDULE_AHEAD_MS } from "@wavesync/shared/constants";

export interface RoomState {
  code: string;
  clients: Map<string, ClientContext>;  // userId → ws context
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackStartServerMs: number | null;  // server time when play started
  playbackOffsetMs: number;              // where in track playback started
  createdAt: number;
}

export class RoomInstance {
  state: RoomState;

  constructor(code: string) {
    this.state = {
      code,
      clients: new Map(),
      queue: [],
      currentTrack: null,
      isPlaying: false,
      playbackStartServerMs: null,
      playbackOffsetMs: 0,
      createdAt: Date.now(),
    };
  }

  getCurrentPositionMs(): number {
    if (!this.state.isPlaying || !this.state.playbackStartServerMs) {
      return this.state.playbackOffsetMs;
    }
    return (Date.now() - this.state.playbackStartServerMs) + this.state.playbackOffsetMs;
  }

  getScheduledExecuteTime(): number {
    // All clients schedule execution SCHEDULE_AHEAD_MS in the future
    return Date.now() + SCHEDULE_AHEAD_MS;
  }

  broadcast(message: object, excludeUserId?: string) {
    const payload = JSON.stringify(message);
    for (const [userId, ctx] of this.state.clients) {
      if (userId !== excludeUserId) {
        ctx.ws.send(payload);
      }
    }
  }

  broadcastAll(message: object) {
    this.broadcast(message);
  }

  addClient(userId: string, ctx: ClientContext) {
    this.state.clients.set(userId, ctx);
  }

  removeClient(userId: string) {
    this.state.clients.delete(userId);
  }

  toRoomStateMsg(serverTimeMs: number) {
    return {
      type: "ROOM_STATE",
      roomCode: this.state.code,
      connectedUsers: Array.from(this.state.clients.values()).map(c => c.user),
      currentTrack: this.state.currentTrack,
      queue: this.state.queue,
      isPlaying: this.state.isPlaying,
      serverPositionMs: this.getCurrentPositionMs(),
      serverTimeMs,
    };
  }
}
```

### 3.3 WebSocket Handler (`ws/handler.ts`)

```typescript
import { z } from "zod";
import { NTPRequestMsg, JoinRoomMsg, PlayMsg, PauseMsg, SeekMsg,
         SkipMsg, AddToQueueMsg, PongMsg } from "@wavesync/shared/schemas";
import { RoomManager } from "../rooms/RoomManager";
import { logger } from "../utils/logger";

export const handleWebSocket = {
  open(ws: ServerWebSocket) {
    ws.data.userId = crypto.randomUUID();
    ws.data.lastPong = Date.now();
    logger.debug({ userId: ws.data.userId }, "WS connection opened");
  },

  message(ws: ServerWebSocket, rawMsg: string | Buffer, roomManager: RoomManager) {
    let parsed: any;
    try {
      parsed = JSON.parse(rawMsg.toString());
    } catch {
      return; // drop malformed JSON silently
    }

    const { type } = parsed;

    switch (type) {
      case "NTP_REQUEST": {
        const msg = NTPRequestMsg.safeParse(parsed);
        if (!msg.success) return;
        const t1 = performance.now() + Date.now(); // high-res server time
        ws.send(JSON.stringify({
          type: "NTP_RESPONSE",
          t0: msg.data.t0,
          t1,
          t2: performance.now() + Date.now(),
        }));
        break;
      }

      case "JOIN_ROOM": {
        const msg = JoinRoomMsg.safeParse(parsed);
        if (!msg.success) return;
        const room = roomManager.getOrCreate(msg.data.roomCode);
        const serverTimeMs = Date.now();
        room.addClient(ws.data.userId, { ws, user: { id: ws.data.userId, displayName: msg.data.displayName, syncOffsetMs: 0, syncQuality: "good" }});
        ws.data.roomCode = msg.data.roomCode;

        // Send full room state to the newly joined client
        ws.send(JSON.stringify(room.toRoomStateMsg(serverTimeMs)));

        // Notify others
        room.broadcast({ type: "USER_JOINED", user: { id: ws.data.userId, displayName: msg.data.displayName }}, ws.data.userId);
        break;
      }

      case "PLAY": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room) return;
        const executeAt = room.getScheduledExecuteTime();
        room.state.isPlaying = true;
        room.state.playbackStartServerMs = executeAt;
        room.broadcastAll({
          type: "SCHEDULED_PLAY",
          serverExecuteAtMs: executeAt,
          trackUrl: room.state.currentTrack?.audioUrl,
          startFromMs: room.state.playbackOffsetMs,
        });
        break;
      }

      case "PAUSE": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room) return;
        const executeAt = room.getScheduledExecuteTime();
        room.state.playbackOffsetMs = room.getCurrentPositionMs();
        room.state.isPlaying = false;
        room.broadcastAll({ type: "SCHEDULED_PAUSE", serverExecuteAtMs: executeAt });
        break;
      }

      case "SEEK": {
        const msg = SeekMsg.safeParse(parsed);
        if (!msg.success) return;
        const room = roomManager.get(ws.data.roomCode);
        if (!room) return;
        const executeAt = room.getScheduledExecuteTime();
        room.state.playbackOffsetMs = msg.data.positionMs;
        room.state.playbackStartServerMs = executeAt;
        room.broadcastAll({ type: "SCHEDULED_SEEK", serverExecuteAtMs: executeAt, positionMs: msg.data.positionMs });
        break;
      }

      case "SKIP": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room || room.state.queue.length === 0) return;
        room.state.currentTrack = room.state.queue.shift()!;
        room.state.playbackOffsetMs = 0;
        room.state.playbackStartServerMs = room.getScheduledExecuteTime();
        room.broadcastAll({ type: "TRACK_CHANGED", track: room.state.currentTrack, queue: room.state.queue });
        room.broadcastAll({ type: "SCHEDULED_PLAY", serverExecuteAtMs: room.state.playbackStartServerMs!, trackUrl: room.state.currentTrack.audioUrl, startFromMs: 0 });
        break;
      }

      case "ADD_TO_QUEUE": {
        const msg = AddToQueueMsg.safeParse(parsed);
        if (!msg.success) return;
        const room = roomManager.get(ws.data.roomCode);
        if (!room) return;
        room.state.queue.push(msg.data.track);
        if (!room.state.currentTrack) {
          room.state.currentTrack = room.state.queue.shift()!;
          // auto-play first track
        }
        room.broadcastAll({ type: "QUEUE_UPDATE", queue: room.state.queue });
        break;
      }

      case "PONG": {
        if (ws.data) ws.data.lastPong = Date.now();
        break;
      }
    }
  },

  close(ws: ServerWebSocket, code: number, reason: string, roomManager: RoomManager) {
    const room = roomManager.get(ws.data?.roomCode);
    if (room) {
      room.removeClient(ws.data.userId);
      room.broadcast({ type: "USER_LEFT", userId: ws.data.userId });
      if (room.state.clients.size === 0) {
        roomManager.scheduleCleanup(ws.data.roomCode, 30 * 60 * 1000); // 30 min idle cleanup
      }
    }
    logger.debug({ userId: ws.data?.userId }, "WS connection closed");
  },
};
```

### 3.4 HTTP Router (`router.ts`)

```typescript
// Key HTTP endpoints:
// GET  /health           → { status, rooms, clients, uptime }
// POST /rooms            → { roomCode } — explicit room creation
// GET  /rooms/:code      → room metadata (unauthenticated preview)
// POST /upload           → multipart upload → R2 → returns signed URL
// GET  /search?q=&src=   → proxied music search (youtube/soundcloud)
// GET  /sign-url?key=    → renew a signed R2 URL
```

---

## 4. Client (`apps/client`)

### 4.1 NTP Synchronization (`utils/ntp.ts`)

```typescript
import { NTP_SAMPLE_COUNT, NTP_MIN_SAMPLES, NTP_FILTER_PERCENTILE } from "@wavesync/shared/constants";

export interface NTPSample {
  offset: number;  // estimated clock offset (client - server)
  rtt: number;     // round-trip time
}

export interface NTPResult {
  offsetMs: number;  // add this to client Date.now() to get server time
  rttMs: number;
  sampleCount: number;
}

/**
 * Sends an NTP_REQUEST and processes the NTP_RESPONSE.
 * t0 = client send time
 * t1 = server receive time
 * t2 = server send time
 * t3 = client receive time (measured here)
 * 
 * offset = ((t1 - t0) + (t2 - t3)) / 2
 * rtt    = (t3 - t0) - (t2 - t1)
 */
export function processNTPResponse(t0: number, t1: number, t2: number, t3: number): NTPSample {
  const offset = ((t1 - t0) + (t2 - t3)) / 2;
  const rtt = (t3 - t0) - (t2 - t1);
  return { offset, rtt };
}

export function computeFinalOffset(samples: NTPSample[]): NTPResult {
  // Sort by RTT, take the bottom NTP_FILTER_PERCENTILE
  const sorted = [...samples].sort((a, b) => a.rtt - b.rtt);
  const cutoff = Math.ceil(sorted.length * NTP_FILTER_PERCENTILE);
  const filtered = sorted.slice(0, cutoff);
  
  // Median offset of filtered samples
  const offsets = filtered.map(s => s.offset).sort((a, b) => a - b);
  const medianOffset = offsets[Math.floor(offsets.length / 2)];
  const avgRtt = filtered.reduce((s, x) => s + x.rtt, 0) / filtered.length;
  
  return { offsetMs: medianOffset, rttMs: avgRtt, sampleCount: samples.length };
}

/** Convert local time to server time */
export function toServerTime(clientTimeMs: number, offsetMs: number): number {
  return clientTimeMs + offsetMs;
}
```

### 4.2 Audio Player (`components/room/AudioPlayer.tsx`)

```typescript
"use client";
import { useEffect, useRef } from "react";
import { useGlobalStore } from "@/store/globalStore";
import { SCHEDULE_AHEAD_MS, STALE_COMMAND_THRESHOLD_MS } from "@wavesync/shared/constants";

export function AudioPlayer() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const { ntpOffset, pendingCommand, clearPendingCommand } = useGlobalStore();

  function getAudioContextTime(serverTimeMs: number): number {
    // Convert server absolute time → local AudioContext time
    const localTimeMs = serverTimeMs - ntpOffset;
    const msUntilEvent = localTimeMs - Date.now();
    return (audioCtxRef.current?.currentTime ?? 0) + msUntilEvent / 1000;
  }

  useEffect(() => {
    if (!pendingCommand || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;

    const { type, serverExecuteAtMs } = pendingCommand;
    const localTimeMs = serverExecuteAtMs - ntpOffset;
    const msUntilEvent = localTimeMs - Date.now();

    // Drop stale commands
    if (msUntilEvent < -STALE_COMMAND_THRESHOLD_MS) {
      console.warn(`Dropping stale command: ${type} was ${-msUntilEvent}ms ago`);
      clearPendingCommand();
      return;
    }

    const audioContextScheduleTime = getAudioContextTime(serverExecuteAtMs);

    if (type === "SCHEDULED_PLAY") {
      // Preload audio buffer, then schedule start
      loadAndSchedulePlay(pendingCommand.trackUrl, pendingCommand.startFromMs, audioContextScheduleTime);
    } else if (type === "SCHEDULED_PAUSE") {
      sourceRef.current?.stop(audioContextScheduleTime);
    } else if (type === "SCHEDULED_SEEK") {
      sourceRef.current?.stop(0);
      loadAndSchedulePlay(pendingCommand.trackUrl, pendingCommand.positionMs, audioContextScheduleTime);
    }

    clearPendingCommand();
  }, [pendingCommand]);

  // AudioContext must be created after user gesture — handled by gesture unlock gate
  return null; // Audio is invisible; visuals are in WaveformVisualizer
}
```

### 4.3 Global Store (`store/globalStore.ts`)

```typescript
import { create } from "zustand";
import { Track, User } from "@wavesync/shared";
import { NTPResult } from "@/utils/ntp";

interface GlobalStore {
  // Connection
  ws: WebSocket | null;
  connected: boolean;
  roomCode: string | null;
  selfUserId: string | null;

  // NTP
  ntpResult: NTPResult | null;
  ntpOffset: number;  // derived from ntpResult.offsetMs
  ntpSamples: number;
  syncQuality: "syncing" | "good" | "fair" | "poor";

  // Room
  connectedUsers: User[];
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  serverPositionMs: number;
  lastServerTimeMs: number;

  // Pending command from server
  pendingCommand: ScheduledCommand | null;

  // Actions
  setWS: (ws: WebSocket) => void;
  setNTPResult: (result: NTPResult) => void;
  setRoomState: (state: Partial<GlobalStore>) => void;
  setPendingCommand: (cmd: ScheduledCommand) => void;
  clearPendingCommand: () => void;
}

export const useGlobalStore = create<GlobalStore>((set) => ({
  ws: null,
  connected: false,
  roomCode: null,
  selfUserId: null,
  ntpResult: null,
  ntpOffset: 0,
  ntpSamples: 0,
  syncQuality: "syncing",
  connectedUsers: [],
  currentTrack: null,
  queue: [],
  isPlaying: false,
  serverPositionMs: 0,
  lastServerTimeMs: 0,
  pendingCommand: null,

  setWS: (ws) => set({ ws, connected: true }),
  setNTPResult: (result) => set({
    ntpResult: result,
    ntpOffset: result.offsetMs,
    ntpSamples: result.sampleCount,
    syncQuality: result.rttMs < 80 ? "good" : result.rttMs < 200 ? "fair" : "poor",
  }),
  setRoomState: (state) => set(state),
  setPendingCommand: (cmd) => set({ pendingCommand: cmd }),
  clearPendingCommand: () => set({ pendingCommand: null }),
}));
```

### 4.4 WebSocket Manager (`components/room/WebSocketManager.tsx`)

```typescript
"use client";
import { useEffect, useRef } from "react";
import { useGlobalStore } from "@/store/globalStore";
import { processNTPResponse, computeFinalOffset } from "@/utils/ntp";
import { NTP_SAMPLE_COUNT, NTP_MIN_SAMPLES, RECONNECT_BACKOFF, RESYNC_INTERVAL_MS, HEARTBEAT_INTERVAL_MS } from "@wavesync/shared/constants";

export function WebSocketManager({ roomCode, displayName }: { roomCode: string; displayName: string }) {
  const wsRef = useRef<WebSocket | null>(null);
  const ntpSamplesRef = useRef<NTPSample[]>([]);
  const reconnectAttempt = useRef(0);
  const { setWS, setNTPResult, setRoomState, setPendingCommand } = useGlobalStore();

  function connect() {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempt.current = 0;
      ws.send(JSON.stringify({ type: "JOIN_ROOM", roomCode, displayName }));
      startNTPSync(ws);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleMessage(msg, ws);
    };

    ws.onclose = () => {
      setRoomState({ connected: false });
      const delay = RECONNECT_BACKOFF[Math.min(reconnectAttempt.current, RECONNECT_BACKOFF.length - 1)];
      reconnectAttempt.current++;
      setTimeout(connect, delay);
    };

    setWS(ws);
  }

  function startNTPSync(ws: WebSocket) {
    ntpSamplesRef.current = [];
    let sent = 0;
    const interval = setInterval(() => {
      if (sent >= NTP_SAMPLE_COUNT) {
        clearInterval(interval);
        return;
      }
      ws.send(JSON.stringify({ type: "NTP_REQUEST", t0: Date.now() }));
      sent++;
    }, 50); // one sample every 50ms
  }

  function handleMessage(msg: any, ws: WebSocket) {
    switch (msg.type) {
      case "NTP_RESPONSE": {
        const t3 = Date.now();
        const sample = processNTPResponse(msg.t0, msg.t1, msg.t2, t3);
        ntpSamplesRef.current.push(sample);
        if (ntpSamplesRef.current.length >= NTP_MIN_SAMPLES) {
          const result = computeFinalOffset(ntpSamplesRef.current);
          setNTPResult(result);
        }
        break;
      }
      case "ROOM_STATE":
        setRoomState({
          connectedUsers: msg.connectedUsers,
          currentTrack: msg.currentTrack,
          queue: msg.queue,
          isPlaying: msg.isPlaying,
          serverPositionMs: msg.serverPositionMs,
          lastServerTimeMs: msg.serverTimeMs,
        });
        break;
      case "SCHEDULED_PLAY":
      case "SCHEDULED_PAUSE":
      case "SCHEDULED_SEEK":
        setPendingCommand(msg);
        break;
      case "PING":
        ws.send(JSON.stringify({ type: "PONG" }));
        break;
      case "USER_JOINED":
      case "USER_LEFT":
      case "QUEUE_UPDATE":
      case "TRACK_CHANGED":
        // update store accordingly
        break;
    }
  }

  useEffect(() => {
    connect();
    // Background re-sync
    const resyncTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        startNTPSync(wsRef.current);
      }
    }, RESYNC_INTERVAL_MS);

    return () => {
      wsRef.current?.close();
      clearInterval(resyncTimer);
    };
  }, [roomCode]);

  return null;
}
```

---

## 5. Music Provider Interface

```typescript
// packages/shared or apps/server/src/providers/MusicProvider.ts

export interface SearchResult {
  id: string;
  title: string;
  artist?: string;
  durationMs: number;
  thumbnailUrl?: string;
  streamUrl: string;  // direct audio URL
  source: "youtube" | "soundcloud" | "upload";
}

export interface MusicProvider {
  search(query: string): Promise<SearchResult[]>;
  getStreamUrl(id: string): Promise<string>;  // resolves to direct audio URL
}

// Implementations:
// - UploadProvider: uploads to R2, returns signed URL
// - YouTubeProvider: uses yt-dlp binary or cobalt.tools API to extract audio URL
// - SoundCloudProvider: uses SoundCloud public resolve API
```

---

## 6. Deployment Configuration

### 6.1 Docker (`Dockerfile`)

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY packages/ packages/
COPY apps/server/ apps/server/
RUN bun install --frozen-lockfile
RUN bun run build --filter=server

FROM oven/bun:1-slim AS runner
WORKDIR /app
COPY --from=base /app/apps/server/dist ./dist
COPY --from=base /app/node_modules ./node_modules
EXPOSE 8080
CMD ["bun", "run", "dist/index.js"]
```

### 6.2 Environment Variables

**Server (`.env`):**
```
PORT=8080
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_BUCKET=wavesync-audio
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
R2_PUBLIC_URL=https://audio.wavesync.app
YOUTUBE_COOKIES=  # optional, for higher rate limits
NODE_ENV=production
```

**Client (`.env.local`):**
```
NEXT_PUBLIC_API_URL=https://api.wavesync.app
NEXT_PUBLIC_WS_URL=wss://api.wavesync.app/ws
```

### 6.3 Recommended Hosting

| Component | Provider | Reason |
|---|---|---|
| Next.js Client | Vercel | Edge CDN, zero-config deploy |
| Bun WebSocket Server | Fly.io | WebSocket support, multi-region, persistent |
| Audio Storage | Cloudflare R2 | No egress fees, global CDN |
| Monitoring | Better Uptime + Pino → Logtail | Lightweight, affordable |
| Redis (v2) | Upstash | Serverless Redis for room state persistence |

---

## 7. Key Engineering Decisions & Rationale

| Decision | Choice | Why |
|---|---|---|
| Runtime | Bun | Native WebSocket, fast startup, TypeScript-first |
| Frontend | Next.js 15 App Router | SSR for SEO on landing, RSC for performance |
| State | Zustand | Lightweight, no boilerplate, works with WebSocket mutations |
| Validation | Zod | Runtime + compile-time safety for WS messages |
| Audio | Web Audio API | Sub-millisecond scheduling precision |
| NTP samples | 40 (filter to bottom 50%) | Balances accuracy vs setup time |
| Schedule lookahead | 400ms | Covers typical network jitter; imperceptible to humans |
| Monorepo | Turborepo | Shared types, fast incremental builds |
| Audio storage | Cloudflare R2 | $0 egress vs S3's per-GB egress cost |
| Mobile sync | Continuous 30s re-sync | Mobile clocks drift faster than desktop |

---

## 8. PWA Configuration (`manifest.json`)

```json
{
  "name": "WaveSync",
  "short_name": "WaveSync",
  "description": "Synchronized music across every device",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#6d28d9",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 9. Testing Strategy

| Layer | Tool | Coverage Target |
|---|---|---|
| Sync math (NTP) | Bun test | 100% — all formula variants |
| WS message schemas | Zod + unit tests | 100% |
| Room state mutations | Bun test | 90% |
| E2E sync (2 clients) | Playwright | Happy path + reconnect |
| Load (1000 clients) | k6 | < 50ms average offset under load |
| Mobile (iOS + Android) | BrowserStack | Manual + screenshot |

---

## 10. Quick Start (Local Dev)

```bash
# Prerequisites: Bun >= 1.1, Node >= 20 (for tooling)

git clone https://github.com/yourorg/wavesync
cd wavesync
bun install           # installs all workspaces

# Copy env files
cp apps/client/.env.example apps/client/.env.local
cp apps/server/.env.example apps/server/.env

# Start both client (:3000) and server (:8080)
bun dev

# Run tests
bun test

# Build for production
bun run build
```
