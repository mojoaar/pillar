import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory rate limiter — same pattern used in server.ts
const buckets = new Map<string, number[]>();

function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const times = buckets.get(key) || [];
  const recent = times.filter((t) => t > now - windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

function sweepRateLimit(maxWindowMs: number) {
  const now = Date.now();
  for (const [key, times] of buckets) {
    const recent = times.filter((t) => t > now - maxWindowMs);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}

describe('rate limiter', () => {
  beforeEach(() => buckets.clear());

  it('allows requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit('test-key', 5, 60000)).toBe(true);
    }
  });

  it('blocks requests exceeding limit', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('test-key', 5, 60000);
    expect(checkRateLimit('test-key', 5, 60000)).toBe(false);
  });

  it('different keys are independently rate-limited', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('key-a', 5, 60000);
    expect(checkRateLimit('key-b', 5, 60000)).toBe(true);
  });

  it('sweep removes expired keys', () => {
    // Add an old entry
    const oldKey = 'old-key';
    buckets.set(oldKey, [Date.now() - 3600001]); // > 1 hour ago
    sweepRateLimit(3600000);
    expect(buckets.has(oldKey)).toBe(false);
  });

  it('sweep keeps recent keys', () => {
    const recentKey = 'recent-key';
    buckets.set(recentKey, [Date.now()]);
    sweepRateLimit(3600000);
    expect(buckets.has(recentKey)).toBe(true);
  });

  it('window-based expiration of individual timestamps', async () => {
    // Fill up to limit
    for (let i = 0; i < 5; i++) checkRateLimit('timed-key', 5, 100);
    expect(checkRateLimit('timed-key', 5, 100)).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 150));
    expect(checkRateLimit('timed-key', 5, 100)).toBe(true);
  });
});
