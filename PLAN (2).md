# PLAN.md — WaveSync
## "Turn every device in the world into a synchronized speaker."

**Product Name:** WaveSync  
**Tagline:** One room. Every song. Every device. Zero lag.  
**Version:** 1.0 (MVP) → 2.0 (Full Launch)  
**Last Updated:** May 2026  
**Status:** Pre-build Planning

---

## 1. Product Vision

WaveSync is a next-generation, millisecond-accurate multi-device audio synchronization platform. Users create or join a "room" with a short code, and every connected device plays the same audio at the exact same moment — whether they're across the room or across the globe. It surpasses Beatsync by adding a global music library (via streaming API integrations), richer room controls, persistent playlists, live waveform visualization, and a mobile-first experience.

**Core Promise:**
> Any device. Any song. Any location. All in sync.

---

## 2. Target Users

| Persona | Use Case |
|---|---|
| Party hosts | Fill a house/venue with synchronized audio from multiple speakers |
| Remote friends | Virtual listening parties over distance |
| DJs / event crews | Multi-device monitoring, cue sync |
| Office / café owners | Synchronized ambient music across zones |
| Music nerds | Precise sync, spatial audio, queue collaboration |

---

## 3. Competitive Analysis

| Feature | Beatsync.gg | WaveSync (Ours) |
|---|---|---|
| Multi-device sync | ✅ Millisecond NTP | ✅ Sub-millisecond NTP v2 |
| Global music library | ❌ Upload only | ✅ Spotify + YouTube + SoundCloud + upload |
| Mobile support | ⚠️ Experimental | ✅ First-class PWA |
| Persistent rooms | ❌ | ✅ Named rooms with history |
| Queue collaboration | ❌ | ✅ Anyone can add songs |
| Spatial audio | ✅ Basic grid | ✅ Advanced 3D positioning |
| Reconnection resilience | ⚠️ | ✅ Auto-rejoin with state restore |
| Offline mode | ❌ | ✅ Cache last 5 songs |
| Room chat | ❌ | ✅ Live emoji + text |
| Waveform visualizer | ❌ | ✅ Real-time per-device |
| Host controls | Basic | ✅ DJ mode, queue lock, volume per device |
| Cross-region latency comp | ❌ | ✅ Region-aware relay nodes |

---

## 4. Feature Scope

### 4.1 MVP (v1.0) — Core Sync + Music Discovery

**Must Have:**
- Room creation with shareable code + QR code
- NTP-v2 clock synchronization (up to 60 samples, Cristian's algorithm + Marzullo's intersection)
- WebSocket-based playback commands (PLAY, PAUSE, SEEK, SKIP)
- Music search via YouTube Music oEmbed / SoundCloud public API / direct URL paste
- File upload (MP3, WAV, FLAC, OGG) → stored in Cloudflare R2
- Queue management (add, remove, reorder)
- Host / listener role system
- Real-time connected-users list
- Sync quality indicator (green/yellow/red offset badge)
- Responsive PWA (mobile + desktop)
- Room persistence for 24 hours

**Should Have:**
- Waveform visualizer (Web Audio API analyser)
- Collaborative queue (listeners can suggest, host approves)
- Room passcode protection
- Dark/light theme

**Nice to Have (v1 stretch):**
- Spatial audio grid (device position → gain mapping)
- Emoji reactions synced across room

### 4.2 Full Launch (v2.0) — Global Library + Scale

- Spotify Web Playback SDK integration (Premium users)
- SoundCloud stream integration
- YouTube embed sync (via postMessage API)
- Named persistent rooms with owner accounts
- Room history + replay last session
- DJ mode: crossfade, BPM sync, transition effects
- Multi-region WebSocket relay (Mumbai, Frankfurt, Virginia, Singapore nodes)
- Admin dashboard (room analytics, active users, uptime)
- Mobile apps (React Native / Capacitor wrapper)

---

## 5. User Flows

### 5.1 Host Flow
```
Land on wavesync.app
  → "Create Room" (auto-generates code e.g. TIGER-7)
  → Enter display name
  → Room dashboard loads
  → Search / upload / paste URL to add first song
  → Share room code or QR with friends
  → Song plays → all devices sync within 50ms
  → Host controls: pause, skip, seek, volume per device
```

### 5.2 Listener Flow
```
Receive code or link
  → Enter code on wavesync.app
  → Enter display name
  → NTP sync phase (progress bar, ~3 seconds)
  → Audio starts playing at exact correct offset
  → Can see queue, upvote songs, add songs (if host allows)
```

### 5.3 Reconnect Flow
```
Device loses connection
  → WebSocket auto-reconnects (exponential backoff: 1s, 2s, 4s, max 30s)
  → On reconnect: re-run NTP sync
  → Server sends current playback position + server time
  → Client schedules audio to resume at correct offset
  → User sees "Resyncing…" badge → turns green
```

---

## 6. Milestones & Timeline

| Milestone | Target | Deliverables |
|---|---|---|
| M0: Architecture Setup | Week 1-2 | Monorepo (Turborepo), Docker, CI/CD pipeline |
| M1: Core Sync Engine | Week 3-4 | WebSocket server, NTP sync, play/pause/seek |
| M2: Music Sources | Week 5-6 | File upload, URL paste, YouTube/SC search |
| M3: UI / PWA | Week 7-8 | Full responsive UI, room dashboard, queue |
| M4: Stability & Testing | Week 9-10 | Load testing (1000 concurrent), mobile QA |
| M5: v1.0 Launch | Week 11 | Public release, monitoring live |
| M6: v2.0 Features | Week 12-20 | Spotify SDK, multi-region, mobile app |

---

## 7. Success Metrics

| Metric | MVP Target | 6-Month Target |
|---|---|---|
| Sync accuracy | < 50ms average offset | < 20ms average offset |
| Reconnect time | < 5 seconds | < 2 seconds |
| Room creation → first play | < 30 seconds | < 15 seconds |
| Mobile NTP success rate | > 95% | > 99% |
| Concurrent rooms (single server) | 500 | 5000 (multi-region) |
| User retention (return within 7 days) | 30% | 50% |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mobile browser AudioContext restrictions | High | Use tap-to-unlock pattern; service worker |
| Streaming API licensing / rate limits | Medium | Abstract provider layer; fallback to upload |
| High latency across continents | Medium | Region-aware relay nodes; adaptive NTP samples |
| WebSocket dropped on mobile networks | High | Heartbeat ping, exponential backoff reconnect |
| Browser clock drift on mobile | Medium | Continuous background NTP re-sync every 30s |
| Cloudflare R2 egress costs at scale | Low | CDN caching, chunked streaming |

---

## 9. Monetization (Post-MVP)

- **Free tier:** 5 devices per room, 2h session, upload up to 50MB
- **Pro ($4.99/mo):** Unlimited devices, 48h rooms, 5GB storage, Spotify integration
- **Team ($14.99/mo):** Named persistent rooms, admin panel, priority relay routing
- **Enterprise:** Custom SLA, on-prem deploy, white-label

---

## 10. Open Source Strategy

WaveSync core sync engine will be MIT-licensed (similar to Beatsync). Proprietary layers: Spotify integration, analytics, admin dashboard. This drives developer trust and organic growth.
