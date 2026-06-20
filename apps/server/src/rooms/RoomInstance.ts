import { Track } from "@wavesync/shared";

export interface RoomState {
  code: string;
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  playbackStartServerMs: number | null;
  playbackOffsetMs: number;
}

interface ClientContext {
  ws: any;
  displayName: string;
  syncOffsetMs: number;
  syncQuality: "syncing" | "good" | "fair" | "poor";
}

export class RoomInstance {
  state: RoomState;
  trackEndTimeout: any = null;
  private clients = new Map<string, ClientContext>();

  constructor(code: string) {
    this.state = {
      code,
      currentTrack: null,
      queue: [],
      isPlaying: false,
      playbackStartServerMs: null,
      playbackOffsetMs: 0,
    };
  }

  clearTrackEndTimeout() {
    if (this.trackEndTimeout) {
      clearTimeout(this.trackEndTimeout);
      this.trackEndTimeout = null;
    }
  }

  addClient(id: string, ws: any, displayName: string) {
    this.clients.set(id, { ws, displayName, syncOffsetMs: 0, syncQuality: "syncing" });
  }

  removeClient(id: string) { this.clients.delete(id); }
  clientCount() { return this.clients.size; }

  updateClientOffset(id: string, offsetMs: number, rttMs?: number) {
    const c = this.clients.get(id);
    if (c) {
      c.syncOffsetMs = offsetMs;
      if (rttMs !== undefined && rttMs >= 999) {
        c.syncQuality = "poor";
      } else {
        const absOffset = Math.abs(offsetMs);
        c.syncQuality = absOffset < 15 ? "good" : absOffset < 50 ? "fair" : "poor";
      }
      // Broadcast the updated users list so everyone sees the new sync quality
      this.broadcastAll({
        type: "USERS_UPDATED",
        connectedUsers: this.getUsers()
      });
    }
  }

  getUsers() {
    return Array.from(this.clients.entries()).map(([id, c]) => {
      return {
        id,
        displayName: c.displayName,
        syncOffsetMs: c.syncOffsetMs,
        syncQuality: c.syncQuality,
      };
    });
  }

  getCurrentPositionMs(): number {
    if (!this.state.isPlaying || !this.state.playbackStartServerMs) {
      return this.state.playbackOffsetMs;
    }
    return (Date.now() - this.state.playbackStartServerMs) + this.state.playbackOffsetMs;
  }

  broadcastAll(msg: object) {
    const payload = JSON.stringify(msg);
    for (const { ws } of this.clients.values()) {
      try { ws.send(payload); } catch {}
    }
  }

  broadcastExcept(excludeId: string, msg: object) {
    const payload = JSON.stringify(msg);
    for (const [id, { ws }] of this.clients.entries()) {
      if (id !== excludeId) {
        try { ws.send(payload); } catch {}
      }
    }
  }
}
