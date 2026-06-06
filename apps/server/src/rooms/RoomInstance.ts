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
}

export class RoomInstance {
  state: RoomState;
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

  addClient(id: string, ws: any, displayName: string) {
    this.clients.set(id, { ws, displayName, syncOffsetMs: 0 });
  }

  removeClient(id: string) { this.clients.delete(id); }
  clientCount() { return this.clients.size; }

  updateClientOffset(id: string, offsetMs: number) {
    const c = this.clients.get(id);
    if (c) c.syncOffsetMs = offsetMs;
  }

  getUsers() {
    return Array.from(this.clients.entries()).map(([id, c]) => {
      const absOffset = Math.abs(c.syncOffsetMs);
      const syncQuality = absOffset < 15 ? "good" : absOffset < 50 ? "fair" : "poor";
      return {
        id,
        displayName: c.displayName,
        syncOffsetMs: c.syncOffsetMs,
        syncQuality,
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
