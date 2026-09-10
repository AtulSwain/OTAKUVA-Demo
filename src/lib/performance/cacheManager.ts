/**
 * OTAKUVA PERFORMANCE — PHASE 10.4
 * HIGH-PERFORMANCE CACHE-ASIDE ENGINE
 * 
 * In-memory cache manager with:
 * - TTL (Time to Live) expiration
 * - Multi-tag invalidation (e.g. invalidate all entries tagged with `tag:anime:123`)
 * - User-Specific Cache Isolation (Strict separation of personalized recommendations)
 * - Cache telemetry (Hit/Miss metrics and hit ratio)
 * - LRU capacity bounding
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
}

export class CacheManager {
  private static store = new Map<string, CacheEntry<any>>();
  private static readonly MAX_ENTRIES = 5000;
  private static hits = 0;
  private static misses = 0;

  /**
   * Retrieves an item from cache, or executes fallback factory and caches result
   */
  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds = 300,
    tags: string[] = []
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlSeconds, tags);
    return value;
  }

  /**
   * Gets cached value if unexpired
   */
  static get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  /**
   * Sets value in cache with TTL and optional tags
   */
  static set<T>(key: string, value: T, ttlSeconds = 300, tags: string[] = []) {
    // Evict oldest entry if capacity exceeded
    if (this.store.size >= this.MAX_ENTRIES) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      tags,
    });
  }

  /**
   * Invalidates a specific cache key
   */
  static invalidate(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * Invalidates all cache keys associated with a specific tag
   * e.g. invalidateTag('anime:cmt123')
   */
  static invalidateTag(tag: string): number {
    let purged = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key);
        purged++;
      }
    }
    return purged;
  }

  /**
   * Helper to build user-isolated cache keys
   */
  static userKey(userId: string, subKey: string): string {
    return `user:${userId}:${subKey}`;
  }

  /**
   * Clears all cache entries
   */
  static clearAll() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Returns cache metrics
   */
  static getMetrics(): {
    totalEntries: number;
    hits: number;
    misses: number;
    hitRatio: number;
  } {
    const total = this.hits + this.misses;
    const hitRatio = total > 0 ? parseFloat((this.hits / total).toFixed(3)) : 0;
    return {
      totalEntries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio,
    };
  }
}
