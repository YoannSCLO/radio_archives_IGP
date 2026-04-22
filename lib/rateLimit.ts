/**
 * Token-bucket en mémoire, par clé (user ou IP). Suffit pour une instance
 * Vercel Function unique ; pour scaler multi-instance, brancher Upstash
 * Redis derrière la même interface `consumeRate`.
 */

export interface RateLimitConfig {
  /** Capacité max du bucket (burst). */
  capacity: number;
  /** Tokens rechargés par seconde. */
  refillPerSec: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanup = 0;

function cleanupIfNeeded(now: number): void {
  if (now - lastCleanup < 300) return;
  lastCleanup = now;
  for (const [key, b] of buckets) {
    if (now - b.lastRefill > 900) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function consumeRate(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now() / 1000;
  cleanupIfNeeded(now);
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: cfg.capacity, lastRefill: now };
    buckets.set(key, b);
  }
  const elapsed = Math.max(0, now - b.lastRefill);
  b.tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillPerSec);
  b.lastRefill = now;
  if (b.tokens < 1) {
    const retry = (1 - b.tokens) / cfg.refillPerSec;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(retry)) };
  }
  b.tokens -= 1;
  return { ok: true, remaining: Math.floor(b.tokens) };
}

/** Détermine la clé de rate-limit depuis les en-têtes / utilisateur. */
export function rateLimitKey(
  user: string | null,
  headers: { [k: string]: string | string[] | undefined }
): string {
  if (user?.trim()) return `u:${user.trim().toLowerCase()}`;
  const xff = headers["x-forwarded-for"];
  const ip = Array.isArray(xff) ? xff[0] : xff;
  if (typeof ip === "string" && ip.trim()) {
    return `ip:${ip.split(",")[0].trim()}`;
  }
  return "anon";
}
