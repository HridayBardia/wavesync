# RULES.md — WaveSync
## Non-Negotiable Engineering, Design & Product Rules

**Purpose:** These rules govern every decision made on WaveSync — from architecture to UI copy. Every contributor, AI agent, and engineer must follow them without exception.

---

## 🔴 RULE CATEGORY 1: SYNC ACCURACY (Sacred — Never Compromise)

### R1.1 — NTP First, Always
Every client MUST complete NTP synchronization before being allowed to start audio playback. No exceptions. No skipping. A "Syncing…" loading state must be visible to the user.

### R1.2 — Minimum 20 NTP Samples
The NTP algorithm must collect a minimum of 20 round-trip samples before computing a clock offset. Production environments must target 40 samples. The median of the lowest-RTT 50% of samples is used (Cristian's algorithm + filter).

### R1.3 — Server Time is Ground Truth
The server's `performance.now()` + epoch is the only valid time reference. Clients must NEVER trust their local `Date.now()` for scheduling playback. All playback events are scheduled as:
```
audioContext.currentTime + (serverScheduledAt - clientClockOffset - now())
```

### R1.4 — Continuous Background Re-sync
After initial sync, clients must run a lightweight background NTP re-sync every 30 seconds to compensate for clock drift (especially on mobile). If offset delta exceeds 15ms, re-sync immediately and notify user.

### R1.5 — Sync Quality Must Be Visible
Every room UI must show a sync quality badge:
- 🟢 Green: offset < 20ms
- 🟡 Yellow: offset 20–80ms
- 🔴 Red: offset > 80ms or disconnected

The user must never be left in the dark about their sync status.

---

## 🔴 RULE CATEGORY 2: WEBSOCKET / CONNECTION

### R2.1 — WebSocket is the Only Real-Time Channel
HTTP polling is FORBIDDEN for any real-time feature. All playback commands, NTP messages, user join/leave events, and queue updates must travel over WebSocket.

### R2.2 — Heartbeat / Ping Required
Server must send a ping every 15 seconds. If a client misses 2 consecutive pings, the server marks it disconnected and removes it from the room's active list. Clients must respond with pong within 5 seconds.

### R2.3 — Exponential Backoff on Reconnect
Client reconnection must use exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (cap). After 5 failed reconnects, show an "Offline" banner and stop retrying silently — require user to tap "Reconnect."

### R2.4 — Stateful Reconnect
On reconnect, the server MUST send the client the current room state:
- Current track info
- Current server playback position (in ms)
- Queue
- Connected users
Clients must re-run NTP sync and seamlessly re-join playback at the correct position.

### R2.5 — Message Validation
Every WebSocket message must be validated against a shared Zod schema (defined in `packages/shared`). Malformed messages must be silently dropped with a server-side error log. Never crash on bad input.

---

## 🔴 RULE CATEGORY 3: AUDIO ENGINE

### R3.1 — Web Audio API Only
All audio playback scheduling MUST use the `AudioContext` API. `<audio>` element playback is only acceptable as a fallback and must never be used for synchronized multi-device playback (timing is not precise enough).

### R3.2 — AudioContext Must Be Unlocked by User Gesture
Mobile browsers block `AudioContext` until a user gesture. The app must show an "Tap to Join Audio" screen and only create the `AudioContext` after that tap. This is non-negotiable for iOS/Android support.

### R3.3 — Preloading Required
Audio must begin preloading (buffering) as soon as a track is added to the queue — not when playback starts. The server should signal upcoming tracks 30 seconds in advance.

### R3.4 — Scheduled Playback with Lookahead
Never call `audioSource.start()` at `audioContext.currentTime`. Always schedule it 300–500ms in the future to allow for network jitter. The schedule buffer is: `audioContext.currentTime + SCHEDULE_AHEAD_MS`.

### R3.5 — Graceful Stale Audio Handling
If a scheduled play event is more than 2 seconds late (device was too slow to receive the command), skip playback and immediately seek to the current correct position. Do not play stale audio.

---

## 🔴 RULE CATEGORY 4: MUSIC SOURCES

### R4.1 — Provider Abstraction Required
All music providers (file upload, YouTube, SoundCloud, Spotify) must be accessed via a unified `MusicProvider` interface. No music-source-specific code may appear outside of `apps/server/src/providers/`. This ensures new providers can be added without touching core sync logic.

### R4.2 — Audio Must Be Hosted, Not Streamed Live for Sync
For sync to work, audio must be fully accessible via a stable URL with byte-range request support (HTTP 206). Live-streamed sources (HLS without seekable segments) are not acceptable for the core sync engine.

### R4.3 — Cloudflare R2 for All Uploads
Uploaded audio files must be stored in Cloudflare R2, served via a CDN-cached public URL. No local disk storage of audio in production.

### R4.4 — File Validation on Upload
Audio uploads must be validated:
- Max size: 200MB
- Accepted formats: MP3, WAV, FLAC, OGG, M4A, AAC
- Duration: max 2 hours
- Virus/malware scan before making public (use Cloudflare Wrangler or equivalent)

### R4.5 — YouTube / SoundCloud: Use as Source, Not as Player
When integrating YouTube/SoundCloud, extract the audio stream URL and host playback via Web Audio API. Do NOT embed iframes for synchronized playback — iframe timing cannot be controlled precisely.

---

## 🔴 RULE CATEGORY 5: CODE QUALITY

### R5.1 — TypeScript Strict Mode Everywhere
All code in `apps/client`, `apps/server`, and `packages/shared` must have `"strict": true` in `tsconfig.json`. `any` types require an explicit comment explaining why.

### R5.2 — Shared Package is the Single Source of Truth
All types, Zod schemas, and utility functions shared between client and server must live in `packages/shared`. Duplicating type definitions is forbidden.

### R5.3 — No Magic Numbers in Sync Code
All timing constants (NTP sample count, schedule lookahead, heartbeat interval, etc.) must be defined as named constants in `packages/shared/constants.ts`. Never hardcode millisecond values inline.

### R5.4 — Server Must Be Stateless-Ready
Room state must be designed so it can be serialized to Redis. Even if Redis is not used in MVP, the data structures must not use non-serializable objects (no Closures, no WeakMaps in room state).

### R5.5 — Tests for Sync Math
The NTP offset calculation and clock synchronization functions must have unit tests with at least 10 test cases covering: normal operation, high-jitter networks, clock drift, negative offsets, and packet loss simulation.

---

## 🔴 RULE CATEGORY 6: UI / UX

### R6.1 — Mobile First
Every screen must be designed at 375px width first. Desktop is an enhancement. No feature may be desktop-only.

### R6.2 — Loading States for Every Async Action
Every button that triggers an async operation must show a loading spinner/state while pending. No fire-and-forget UI.

### R6.3 — Error States Must Be Human-Readable
Error messages shown to users must never include stack traces, technical jargon, or error codes alone. Always provide: what went wrong + what to do next.

### R6.4 — Accessibility Baseline
All interactive elements must have ARIA labels. Color alone must not convey meaning (sync quality badge uses color + icon + text). Keyboard navigation must work for core flows.

### R6.5 — No Autoplay Without User Consent
The app must never attempt to play audio without an explicit user action (joining a room counts, but must be a tap/click — not a page load).

---

## 🔴 RULE CATEGORY 7: SECURITY

### R7.1 — Room Codes Are Not Security
Room codes (e.g., TIGER-7) are for convenience, not security. For private rooms, a separate passcode mechanism is required. Do not advertise room codes as private.

### R7.2 — Rate Limit All Endpoints
Every HTTP and WebSocket message type must have a rate limit. NTP messages: max 5/second per client. Room creation: max 10/hour per IP.

### R7.3 — No User PII in Logs
Display names and room codes may appear in logs. Email addresses, IPs (beyond rate limiting), and device fingerprints must not be logged.

### R7.4 — Audio URLs Must Be Signed
Cloudflare R2 audio URLs served to clients must be time-limited signed URLs (expiry: 4 hours). Raw bucket paths must never be exposed publicly.

---

## 🔴 RULE CATEGORY 8: OPERATIONS

### R8.1 — Health Check Endpoint Required
The server must expose `GET /health` returning `{ status: "ok", rooms: N, clients: N, uptime: N }`. This is used by monitoring and load balancers.

### R8.2 — Graceful Shutdown
On SIGTERM, the server must: stop accepting new connections → send "server-shutdown" message to all connected clients → wait up to 10 seconds for cleanup → exit. Clients must handle "server-shutdown" by showing a reconnect UI.

### R8.3 — Log Levels Must Be Respected
Use structured logging (pino or equivalent). Production: `warn` and above only. Development: `debug` and above. Never use `console.log` in production code.

### R8.4 — Environment Variables for All Secrets
No secrets, API keys, or environment-specific URLs may appear in source code. All must come from environment variables validated at startup via Zod.

---

## Summary Cheatsheet

| Category | Key Rule |
|---|---|
| Sync | NTP first, 20+ samples, server time is truth |
| WebSocket | No polling, heartbeat, stateful reconnect |
| Audio | Web Audio API only, gesture unlock, preload |
| Music | Provider abstraction, R2 storage, validate uploads |
| Code | TypeScript strict, shared package, test sync math |
| UI | Mobile first, loading states, accessible |
| Security | Signed URLs, rate limits, no PII in logs |
| Ops | Health check, graceful shutdown, structured logs |
