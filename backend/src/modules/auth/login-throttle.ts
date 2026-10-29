/* Counts failed sign-ins per key (employee code, IP) in a sliding window.
   In memory, so it resets on restart and is per server instance — enough for one internal
   server; move to the database or Redis if the API ever runs on several instances. */
export interface ThrottleOptions {
  maxFailures: number;
  windowMs: number;
  now?: () => number;
}

export function createThrottle({ maxFailures, windowMs, now = Date.now }: ThrottleOptions) {
  const failures = new Map<string, number[]>();

  const recent = (key: string) => {
    const cutoff = now() - windowMs;
    const kept = (failures.get(key) ?? []).filter((t) => t > cutoff);
    if (kept.length) failures.set(key, kept); else failures.delete(key);
    return kept;
  };

  return {
    /** Seconds until the key may try again, or 0 if not blocked */
    retryAfter(key: string): number {
      const r = recent(key);
      if (r.length < maxFailures) return 0;
      return Math.max(1, Math.ceil((r[0] + windowMs - now()) / 1000));
    },
    fail(key: string) {
      failures.set(key, [...recent(key), now()]);
    },
    reset(key: string) {
      failures.delete(key);
    },
  };
}

export type Throttle = ReturnType<typeof createThrottle>;
