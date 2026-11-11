// =============================================================================
// MoneyMate — Sliding Window Rate Limiter for API Protection (Section 7)
// Protects Auth, Upload, AI Processing, and Trial endpoints from abuse
// =============================================================================

interface RateBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateBucket>();

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(params.key);

  if (!existing || now > existing.resetAt) {
    const fresh: RateBucket = {
      count: 1,
      resetAt: now + params.windowMs,
    };
    buckets.set(params.key, fresh);
    return {
      allowed: true,
      remaining: Math.max(0, params.limit - 1),
      resetAt: fresh.resetAt,
    };
  }

  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, params.limit - existing.count),
    resetAt: existing.resetAt,
  };
}
