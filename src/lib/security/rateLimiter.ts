/**
 * OTAKUVA SECURITY — PHASE 10.1 & 10.3
 * CATEGORY-AWARE RATE LIMITER ENGINE
 * 
 * Fine-grained sliding window rate limiter tailored by endpoint sensitivity:
 * - AUTH: 5 requests / 60s (strict anti-brute-force)
 * - RATINGS: 15 ratings / 60s (anti-burst rating spam)
 * - REVIEWS: 5 reviews / 60s (quality review throttling)
 * - COMMENTS: 15 comments / 60s (discussion spam control)
 * - COMMUNITY: 8 actions / 60s (community creation throttling)
 * - CHAT: 30 messages / 60s (anti-flood)
 * - SEARCH: 60 queries / 60s (search DDoS mitigation)
 * - PUBLIC_READ: 120 requests / 60s (general catalog browsing)
 * - ADMIN: 120 requests / 60s (staff operations)
 */

export type RateLimitCategory =
  | 'AUTH'
  | 'RATINGS'
  | 'REVIEWS'
  | 'COMMENTS'
  | 'COMMUNITY'
  | 'CHAT'
  | 'SEARCH'
  | 'PUBLIC_READ'
  | 'ADMIN'
  | 'MEDIA_UPLOAD';

export interface RateLimitPolicy {
  maxRequests: number;
  windowMs: number;
}

export const RATE_LIMIT_POLICIES: Record<RateLimitCategory, RateLimitPolicy> = {
  AUTH: { maxRequests: 5, windowMs: 60 * 1000 },
  RATINGS: { maxRequests: 15, windowMs: 60 * 1000 },
  REVIEWS: { maxRequests: 5, windowMs: 60 * 1000 },
  COMMENTS: { maxRequests: 15, windowMs: 60 * 1000 },
  COMMUNITY: { maxRequests: 8, windowMs: 60 * 1000 },
  CHAT: { maxRequests: 30, windowMs: 60 * 1000 },
  SEARCH: { maxRequests: 60, windowMs: 60 * 1000 },
  PUBLIC_READ: { maxRequests: 120, windowMs: 60 * 1000 },
  ADMIN: { maxRequests: 120, windowMs: 60 * 1000 },
  MEDIA_UPLOAD: { maxRequests: 10, windowMs: 60 * 1000 },
};

export interface RateLimitStatus {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  remaining: number;
  resetMs: number;
  retryAfterSec?: number;
}

export class RateLimiter {
  private static store = new Map<string, number[]>();

  /**
   * Evaluates if a request is allowed under the category policy
   */
  static checkRateLimit(
    category: RateLimitCategory,
    identifier: string,
    customPolicy?: Partial<RateLimitPolicy>
  ): RateLimitStatus {
    const policy: RateLimitPolicy = {
      ...RATE_LIMIT_POLICIES[category],
      ...customPolicy,
    };

    const key = `${category}:${identifier}`;
    const now = Date.now();
    const windowStart = now - policy.windowMs;

    const timestamps = this.store.get(key) || [];
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= policy.maxRequests) {
      const oldest = validTimestamps[0];
      const resetMs = oldest + policy.windowMs - now;
      const retryAfterSec = Math.max(1, Math.ceil(resetMs / 1000));

      this.store.set(key, validTimestamps);
      return {
        allowed: false,
        currentCount: validTimestamps.length,
        maxAllowed: policy.maxRequests,
        remaining: 0,
        resetMs,
        retryAfterSec,
      };
    }

    validTimestamps.push(now);
    this.store.set(key, validTimestamps);

    return {
      allowed: true,
      currentCount: validTimestamps.length,
      maxAllowed: policy.maxRequests,
      remaining: policy.maxRequests - validTimestamps.length,
      resetMs: policy.windowMs,
    };
  }

  /**
   * Resets rate limit for an identifier (useful in tests or after successful verification)
   */
  static reset(category: RateLimitCategory, identifier: string) {
    this.store.delete(`${category}:${identifier}`);
  }

  /**
   * Cleans up expired rate limit entries to prevent memory growth
   */
  static cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.store.entries()) {
      const valid = timestamps.filter((t) => t > now - 3600000); // 1hr max age
      if (valid.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, valid);
      }
    }
  }
}
