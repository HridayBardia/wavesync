interface RateLimiterOpts {
  windowMs: number;
  max: number;
}

export class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(private opts: RateLimiterOpts) {}

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    
    // Filter out timestamps outside the window
    const windowStart = now - this.opts.windowMs;
    const activeTimestamps = timestamps.filter(t => t > windowStart);
    
    if (activeTimestamps.length >= this.opts.max) {
      return true;
    }
    
    activeTimestamps.push(now);
    this.requests.set(key, activeTimestamps);
    return false;
  }
}

// Global instances for rate limiting
export const ntpRateLimiter = new RateLimiter({ windowMs: 1000, max: 100 }); // max 100 per second to accommodate calibration bursts
export const roomCreationRateLimiter = new RateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }); // max 10 per hour
export const generalWsRateLimiter = new RateLimiter({ windowMs: 1000, max: 200 }); // max 200 messages per second for general commands

