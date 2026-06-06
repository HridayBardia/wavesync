import { RoomInstance } from "./RoomInstance";
import { logger } from "../utils/logger";

export class RoomManager {
  private rooms = new Map<string, RoomInstance>();
  private cleanupTimers = new Map<string, any>(); // RoomCode -> Timer ID

  get(code: string): RoomInstance | undefined {
    if (!code) return undefined;
    return this.rooms.get(code.toUpperCase());
  }

  getOrCreate(code: string): RoomInstance {
    const uppercaseCode = code.toUpperCase();
    
    // Cancel any pending cleanup timer for this room
    const timer = this.cleanupTimers.get(uppercaseCode);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(uppercaseCode);
      logger.info({ roomCode: uppercaseCode }, "Cancelled idle cleanup for room");
    }

    let room = this.rooms.get(uppercaseCode);
    if (!room) {
      room = new RoomInstance(uppercaseCode);
      this.rooms.set(uppercaseCode, room);
      logger.info({ roomCode: uppercaseCode }, "Created new room instance");
    }
    return room;
  }

  scheduleCleanup(code: string, delayMs: number) {
    const uppercaseCode = code.toUpperCase();
    
    // Clear existing timer if any
    const existingTimer = this.cleanupTimers.get(uppercaseCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      const room = this.rooms.get(uppercaseCode);
      if (room && room.clientCount() === 0) {
        this.rooms.delete(uppercaseCode);
        logger.info({ roomCode: uppercaseCode }, "Cleaned up idle room");
      }
      this.cleanupTimers.delete(uppercaseCode);
    }, delayMs);

    this.cleanupTimers.set(uppercaseCode, timer);
    logger.info({ roomCode: uppercaseCode, delayMs }, "Scheduled idle cleanup for room");
  }

  broadcastAll(message: object) {
    for (const room of this.rooms.values()) {
      room.broadcastAll(message);
    }
  }

  getActiveRoomCount(): number {
    return this.rooms.size;
  }

  getActiveClientCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.clientCount();
    }
    return count;
  }
}
