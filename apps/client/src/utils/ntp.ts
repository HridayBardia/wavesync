// apps/client/src/utils/ntp.ts

export interface NTPSample { offset: number; rtt: number; }
export interface NTPResult { offsetMs: number; rttMs: number; sampleCount: number; }

/**
 * t0 = client sent
 * t1 = server received
 * t2 = server sent response
 * t3 = client received (measured now)
 */
export function processNTPResponse(t0: number, t1: number, t2: number, t3: number): NTPSample {
  const offset = ((t1 - t0) + (t2 - t3)) / 2;
  const rtt = (t3 - t0) - (t2 - t1);
  return { offset, rtt };
}

export function computeFinalOffset(samples: NTPSample[]): NTPResult {
  if (samples.length === 0) return { offsetMs: 0, rttMs: 0, sampleCount: 0 };
  // Sort by RTT, take best 50%
  const sorted = [...samples].sort((a, b) => a.rtt - b.rtt);
  const best = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.5)));
  const offsets = best.map(s => s.offset).sort((a, b) => a - b);
  const median = offsets[Math.floor(offsets.length / 2)];
  const avgRtt = best.reduce((s, x) => s + x.rtt, 0) / best.length;
  return { offsetMs: median, rttMs: avgRtt, sampleCount: samples.length };
}

/** Convert local Date.now() to estimated server time */
export function toServerTime(localMs: number, offsetMs: number): number {
  return localMs + offsetMs;
}

/** How far into the track are we right now? */
export function getCurrentTrackPosition(
  serverPositionAtSync: number,
  lastServerTimeMs: number,
  offsetMs: number,
): number {
  const serverNow = Date.now() + offsetMs;
  const elapsed = serverNow - lastServerTimeMs;
  return serverPositionAtSync + elapsed;
}

