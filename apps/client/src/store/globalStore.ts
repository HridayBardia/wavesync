import { create } from "zustand";

export interface Track {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  durationMs: number;
  thumbnailUrl: string;
  audioUrl: string; // e.g. "http://localhost:8080/stream/dQw4w9WgXcQ"
  source: string;
  addedBy: string;
}

export interface SyncedUser {
  id: string;
  displayName: string;
  syncOffsetMs: number;
  syncQuality?: "syncing" | "good" | "fair" | "poor";
}

interface Store {
  // Connection
  ws: WebSocket | null;
  connected: boolean;
  roomCode: string;
  displayName: string;

  // NTP — CRITICAL: hasSyncedOnce never goes false once true
  ntpOffsetMs: number;
  ntpRttMs: number;
  ntpSamples: number;
  syncQuality: "syncing" | "good" | "fair" | "poor";
  hasSyncedOnce: boolean; // NEVER reset to false after first sync

  // AudioContext gate — stored globally, never reset
  gestureUnlocked: boolean;

  // Room state
  connectedUsers: SyncedUser[];
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  serverPositionMs: number;
  lastServerTimeMs: number;

  // Pending playback command
  pendingCommand: any | null;

  // Toast error
  toastError: string;

  // Actions
  setWS: (ws: WebSocket) => void;
  setConnected: (v: boolean) => void;
  setGestureUnlocked: () => void;

  // NTP — background resync MUST NOT reset hasSyncedOnce or show syncing screen
  updateNTP: (offsetMs: number, rttMs: number, sampleCount: number) => void;

  applyServerMessage: (msg: any) => void;
  setPendingCommand: (cmd: any) => void;
  clearPendingCommand: () => void;
  setToastError: (msg: string) => void;
  sendWS: (msg: object) => void;
  sendCommand: (cmd: any) => void; // Keep for backward compatibility with RoomDashboard
  setRoomInfo: (roomCode: string, displayName: string) => void;
}

export const useStore = create<Store>((set, get) => ({
  ws: null,
  connected: false,
  roomCode: "",
  displayName: "",
  ntpOffsetMs: 0,
  ntpRttMs: 999,
  ntpSamples: 0,
  syncQuality: "syncing",
  hasSyncedOnce: false,      // KEY: stays true once set
  gestureUnlocked: false,    // KEY: stored globally, never reset by re-renders
  connectedUsers: [],
  currentTrack: null,
  queue: [],
  isPlaying: false,
  serverPositionMs: 0,
  lastServerTimeMs: 0,
  pendingCommand: null,
  toastError: "",

  setWS: (ws) => set({ ws, connected: true }),
  setConnected: (connected) => set({ connected }),

  setGestureUnlocked: () => set({ gestureUnlocked: true }),

  updateNTP: (offsetMs, rttMs, sampleCount) => {
    const quality = rttMs < 50 ? "good" : rttMs < 150 ? "fair" : "poor";
    set((s) => ({
      ntpOffsetMs: offsetMs,
      ntpRttMs: rttMs,
      ntpSamples: sampleCount,
      syncQuality: quality,
      // CRITICAL: hasSyncedOnce only goes true, NEVER false
      hasSyncedOnce: s.hasSyncedOnce || sampleCount >= 5,
    }));
  },

  applyServerMessage: (msg) => {
    try {
      switch (msg.type) {
        case "ROOM_STATE":
          set({
            roomCode: msg.roomCode ?? get().roomCode,
            connectedUsers: msg.connectedUsers ?? [],
            currentTrack: msg.currentTrack ?? null,
            queue: msg.queue ?? [],
            isPlaying: msg.isPlaying ?? false,
            serverPositionMs: msg.serverPositionMs ?? 0,
            lastServerTimeMs: msg.serverTimeMs ?? Date.now(),
          });
          
          // Catch-up play for late joiners if already playing
          if (msg.isPlaying && msg.currentTrack) {
            set({
              pendingCommand: {
                type: "SCHEDULED_PLAY",
                serverExecuteAtMs: (msg.serverTimeMs ?? Date.now()) + 500, // execute 500ms from the time we got the state
                trackUrl: msg.currentTrack.audioUrl,
                startFromMs: (msg.serverPositionMs ?? 0) + 500
              }
            });
          }
          break;
        case "USERS_UPDATED":
          set({ connectedUsers: msg.connectedUsers ?? [] });
          break;
        case "QUEUE_UPDATE":
          set({
            currentTrack: msg.currentTrack ?? get().currentTrack,
            queue: msg.queue ?? [],
          });
          break;
        case "TRACK_CHANGED":
          set({ currentTrack: msg.track ?? null, queue: msg.queue ?? [] });
          break;
        case "USER_JOINED":
          set((s) => ({
            connectedUsers: [
              ...s.connectedUsers.filter((u) => u.id !== msg.user.id),
              msg.user,
            ],
          }));
          break;
        case "USER_LEFT":
          set((s) => ({
            connectedUsers: s.connectedUsers.filter((u) => u.id !== msg.userId),
          }));
          break;
        case "SCHEDULED_PLAY":
        case "SCHEDULED_PAUSE":
        case "SCHEDULED_SEEK":
          set({ pendingCommand: msg, isPlaying: msg.type !== "SCHEDULED_PAUSE" });
          break;
      }
    } catch (e) {
      console.error("[Store] applyServerMessage error:", e);
    }
  },

  setPendingCommand: (cmd) => set({ pendingCommand: cmd }),
  clearPendingCommand: () => set({ pendingCommand: null }),
  setToastError: (msg) => {
    set({ toastError: msg });
    setTimeout(() => set({ toastError: "" }), 4000);
  },

  sendWS: (msg) => {
    const ws = get().ws;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  },

  sendCommand: (cmd) => {
    get().sendWS(cmd);
  },

  setRoomInfo: (roomCode, displayName) => set({ roomCode, displayName }),
}));

// Export useGlobalStore as useStore alias to maintain backwards compatibility
export const useGlobalStore = useStore;
