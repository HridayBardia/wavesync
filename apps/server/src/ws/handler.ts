import { RoomManager } from "../rooms/RoomManager";

const SCHEDULE_AHEAD_MS = 400;

export const handleWS = {
  open(ws: any, roomManager: RoomManager) {
    ws.data.userId = crypto.randomUUID();
    ws.data.roomCode = "";
    ws.data.lastPong = Date.now();
  },

  message(ws: any, raw: string | Buffer, roomManager: RoomManager) {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case "NTP_REQUEST": {
        const t1 = Date.now();
        ws.send(JSON.stringify({
          type: "NTP_RESPONSE",
          t0: msg.t0,
          t1,
          t2: Date.now(),
        }));
        break;
      }

      case "PING": {
        ws.send(JSON.stringify({ type: "PONG", serverTimeMs: Date.now() }));
        break;
      }

      case "JOIN_ROOM": {
        const { roomCode, displayName } = msg;
        if (!roomCode || !displayName) return;

        const uppercaseCode = roomCode.toUpperCase();
        ws.data.roomCode = uppercaseCode;
        ws.data.displayName = displayName;

        const room = roomManager.getOrCreate(uppercaseCode);
        room.addClient(ws.data.userId, ws, displayName);

        // Send full state to new client
        ws.send(JSON.stringify({
          type: "ROOM_STATE",
          roomCode: uppercaseCode,
          connectedUsers: room.getUsers(),
          currentTrack: room.state.currentTrack,
          queue: room.state.queue,
          isPlaying: room.state.isPlaying,
          serverPositionMs: room.getCurrentPositionMs(),
          serverTimeMs: Date.now(),
        }));

        // Notify others
        room.broadcastExcept(ws.data.userId, {
          type: "USER_JOINED",
          user: { id: ws.data.userId, displayName, syncOffsetMs: 0, syncQuality: "syncing" },
        });
        break;
      }

      case "PLAY": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room || !room.state.currentTrack) return;
        const executeAt = Date.now() + SCHEDULE_AHEAD_MS;
        room.state.isPlaying = true;
        room.state.playbackStartServerMs = executeAt;
        room.broadcastAll({
          type: "SCHEDULED_PLAY",
          serverExecuteAtMs: executeAt,
          trackUrl: room.state.currentTrack.audioUrl,
          startFromMs: room.state.playbackOffsetMs,
        });
        scheduleAutoAdvance(room, ws.data.roomCode, roomManager);
        break;
      }

      case "PAUSE": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room) return;
        const executeAt = Date.now() + SCHEDULE_AHEAD_MS;
        room.state.playbackOffsetMs = room.getCurrentPositionMs();
        room.state.isPlaying = false;
        room.clearTrackEndTimeout();
        room.broadcastAll({ type: "SCHEDULED_PAUSE", serverExecuteAtMs: executeAt });
        break;
      }

      case "SEEK": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room || !room.state.currentTrack) return;
        const executeAt = Date.now() + SCHEDULE_AHEAD_MS;
        room.state.playbackOffsetMs = msg.positionMs;
        room.state.playbackStartServerMs = executeAt;
        room.broadcastAll({
          type: "SCHEDULED_SEEK",
          serverExecuteAtMs: executeAt,
          positionMs: msg.positionMs,
          trackUrl: room.state.currentTrack.audioUrl,
        });
        scheduleAutoAdvance(room, ws.data.roomCode, roomManager);
        break;
      }

      case "SKIP": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room || room.state.queue.length === 0) return;
        room.state.currentTrack = room.state.queue.shift()!;
        room.state.playbackOffsetMs = 0;
        const executeAt = Date.now() + SCHEDULE_AHEAD_MS;
        room.state.playbackStartServerMs = executeAt;
        room.state.isPlaying = true;
        room.broadcastAll({
          type: "TRACK_CHANGED",
          track: room.state.currentTrack,
          queue: room.state.queue,
        });
        room.broadcastAll({
          type: "SCHEDULED_PLAY",
          serverExecuteAtMs: executeAt,
          trackUrl: room.state.currentTrack.audioUrl,
          startFromMs: 0,
        });
        scheduleAutoAdvance(room, ws.data.roomCode, roomManager);
        break;
      }

      case "ADD_TO_QUEUE": {
        const room = roomManager.get(ws.data.roomCode);
        if (!room || !msg.track) return;

        const isFirstTrack = !room.state.currentTrack && room.state.queue.length === 0;

        if (!room.state.currentTrack) {
          room.state.currentTrack = msg.track;
        } else {
          room.state.queue.push(msg.track);
        }

        room.broadcastAll({
          type: "QUEUE_UPDATE",
          currentTrack: room.state.currentTrack,
          queue: room.state.queue,
        });

        // If this was the first track, auto-play
        if (isFirstTrack && room.state.currentTrack) {
          const executeAt = Date.now() + SCHEDULE_AHEAD_MS;
          room.state.isPlaying = true;
          room.state.playbackStartServerMs = executeAt;
          room.state.playbackOffsetMs = 0;
          room.broadcastAll({
            type: "SCHEDULED_PLAY",
            serverExecuteAtMs: executeAt,
            trackUrl: room.state.currentTrack.audioUrl,
            startFromMs: 0,
          });
          scheduleAutoAdvance(room, ws.data.roomCode, roomManager);
        }
        break;
      }

      case "UPDATE_SYNC_OFFSET": {
        const room = roomManager.get(ws.data.roomCode);
        if (room) room.updateClientOffset(ws.data.userId, msg.offsetMs, msg.rttMs);
        break;
      }
    }
  },

  close(ws: any, roomManager: RoomManager) {
    const room = roomManager.get(ws.data.roomCode);
    if (room) {
      room.removeClient(ws.data.userId);
      room.broadcastAll({ type: "USER_LEFT", userId: ws.data.userId });
      if (room.clientCount() === 0) roomManager.scheduleCleanup(ws.data.roomCode, 30 * 60 * 1000);
    }
  },
};

function scheduleAutoAdvance(room: any, roomCode: string, roomManager: RoomManager) {
  room.clearTrackEndTimeout();
  if (room.state.isPlaying && room.state.currentTrack && room.state.currentTrack.durationMs > 0) {
    const msRemaining = room.state.currentTrack.durationMs - room.state.playbackOffsetMs;
    room.trackEndTimeout = setTimeout(() => {
      autoAdvance(roomCode, roomManager);
    }, Math.max(0, msRemaining + 500));
  }
}

function autoAdvance(roomCode: string, roomManager: RoomManager) {
  const room = roomManager.get(roomCode);
  if (!room) return;
  room.clearTrackEndTimeout();

  if (room.state.queue.length > 0) {
    room.state.currentTrack = room.state.queue.shift()!;
    room.state.playbackOffsetMs = 0;
    const executeAt = Date.now() + SCHEDULE_AHEAD_MS;
    room.state.playbackStartServerMs = executeAt;
    room.state.isPlaying = true;
    room.broadcastAll({
      type: "TRACK_CHANGED",
      track: room.state.currentTrack,
      queue: room.state.queue,
    });
    room.broadcastAll({
      type: "SCHEDULED_PLAY",
      serverExecuteAtMs: executeAt,
      trackUrl: room.state.currentTrack.audioUrl,
      startFromMs: 0,
    });

    scheduleAutoAdvance(room, roomCode, roomManager);
  } else {
    room.state.currentTrack = null;
    room.state.isPlaying = false;
    room.state.playbackOffsetMs = 0;
    room.state.playbackStartServerMs = null;
    room.broadcastAll({
      type: "TRACK_CHANGED",
      track: null,
      queue: [],
    });
  }
}
