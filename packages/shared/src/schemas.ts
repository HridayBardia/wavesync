import { z } from "zod";

// ─── DOMAIN SCHEMAS ────────────────────────────────────────────

export const TrackSchema = z.object({
  id: z.string(),
  youtubeId: z.string().optional(),
  title: z.string(),
  artist: z.string().optional(),
  durationMs: z.number(),
  audioUrl: z.string(),   // URL (can be signed R2, CDN, or local fallback URL)
  thumbnailUrl: z.string().optional(),
  source: z.enum(["upload", "youtube", "soundcloud", "spotify"]),
  addedBy: z.string(),          // display name
});

export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  syncOffsetMs: z.number(),    // clock offset (client - server)
  syncQuality: z.enum(["syncing", "good", "fair", "poor"]),
  spatialX: z.number().optional(),
  spatialY: z.number().optional(),
});

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

export const SpatialUpdateMsg = z.object({
  type: z.literal("SPATIAL_UPDATE"),
  roomCode: z.string(),
  spatialX: z.number(),
  spatialY: z.number(),
});

export const UpdateSyncOffsetMsg = z.object({
  type: z.literal("UPDATE_SYNC_OFFSET"),
  offsetMs: z.number(),
  rttMs: z.number().optional(),
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
  trackUrl: z.string(),
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

export const UsersUpdatedMsg = z.object({
  type: z.literal("USERS_UPDATED"),
  connectedUsers: z.array(UserSchema),
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

export const ServerShutdownMsg = z.object({
  type: z.literal("SERVER_SHUTDOWN"),
  message: z.string(),
});

export const TrackChangedMsg = z.object({
  type: z.literal("TRACK_CHANGED"),
  track: TrackSchema.nullable(),
  queue: z.array(TrackSchema),
});

export const SyncUpdateMsg = z.object({
  type: z.literal("SYNC_UPDATE"),
  syncOffsetMs: z.number(),
  syncQuality: z.enum(["syncing", "good", "fair", "poor"]),
});

// ─── TS TYPE DERIVATIONS ───────────────────────────────────────

export type Track = z.infer<typeof TrackSchema>;
export type User = z.infer<typeof UserSchema>;

export type JoinRoomMsg = z.infer<typeof JoinRoomMsg>;
export type NTPRequestMsg = z.infer<typeof NTPRequestMsg>;
export type PlayMsg = z.infer<typeof PlayMsg>;
export type PauseMsg = z.infer<typeof PauseMsg>;
export type SeekMsg = z.infer<typeof SeekMsg>;
export type SkipMsg = z.infer<typeof SkipMsg>;
export type AddToQueueMsg = z.infer<typeof AddToQueueMsg>;
export type PongMsg = z.infer<typeof PongMsg>;
export type SpatialUpdateMsg = z.infer<typeof SpatialUpdateMsg>;
export type UpdateSyncOffsetMsg = z.infer<typeof UpdateSyncOffsetMsg>;

export type NTPResponseMsg = z.infer<typeof NTPResponseMsg>;
export type RoomStateMsg = z.infer<typeof RoomStateMsg>;
export type ScheduledPlayMsg = z.infer<typeof ScheduledPlayMsg>;
export type ScheduledPauseMsg = z.infer<typeof ScheduledPauseMsg>;
export type ScheduledSeekMsg = z.infer<typeof ScheduledSeekMsg>;
export type QueueUpdateMsg = z.infer<typeof QueueUpdateMsg>;
export type UserJoinedMsg = z.infer<typeof UserJoinedMsg>;
export type UserLeftMsg = z.infer<typeof UserLeftMsg>;
export type UsersUpdatedMsg = z.infer<typeof UsersUpdatedMsg>;
export type PingMsg = z.infer<typeof PingMsg>;
export type ErrorMsg = z.infer<typeof ErrorMsg>;
export type ServerShutdownMsg = z.infer<typeof ServerShutdownMsg>;
export type TrackChangedMsg = z.infer<typeof TrackChangedMsg>;
export type SyncUpdateMsg = z.infer<typeof SyncUpdateMsg>;

export type ScheduledCommand =
  | { type: "SCHEDULED_PLAY"; serverExecuteAtMs: number; trackUrl: string; startFromMs: number }
  | { type: "SCHEDULED_PAUSE"; serverExecuteAtMs: number }
  | { type: "SCHEDULED_SEEK"; serverExecuteAtMs: number; positionMs: number };
