/**
 * OTAKUVA RELIABILITY — PHASE 10.5
 * IDEMPOTENCY ENGINE
 * 
 * Guarantees duplicate-safe execution for critical operations:
 * - Prevents duplicate form submissions, double ratings, and duplicate event ingestion
 * - In-memory key store with TTL
 * - Tracks processing state (PENDING -> COMPLETED / FAILED)
 */

export interface IdempotencyRecord {
  key: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  result?: any;
  createdAt: number;
  expiresAt: number;
}

export class IdempotencyService {
  private static store = new Map<string, IdempotencyRecord>();
  private static readonly DEFAULT_TTL_MS = 60 * 1000; // 60s TTL

  /**
   * Executes an operation with idempotency protection
   */
  static async executeIdempotent<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
    ttlMs = this.DEFAULT_TTL_MS
  ): Promise<{ isDuplicate: boolean; result: T }> {
    const now = Date.now();
    const existing = this.store.get(idempotencyKey);

    if (existing && existing.expiresAt > now) {
      if (existing.status === 'COMPLETED') {
        return { isDuplicate: true, result: existing.result };
      }
      if (existing.status === 'PENDING') {
        throw new Error('Concurrent request with the same idempotency key is currently processing.');
      }
    }

    // Register PENDING record
    this.store.set(idempotencyKey, {
      key: idempotencyKey,
      status: 'PENDING',
      createdAt: now,
      expiresAt: now + ttlMs,
    });

    try {
      const result = await operation();

      this.store.set(idempotencyKey, {
        key: idempotencyKey,
        status: 'COMPLETED',
        result,
        createdAt: now,
        expiresAt: now + ttlMs,
      });

      return { isDuplicate: false, result };
    } catch (err) {
      this.store.set(idempotencyKey, {
        key: idempotencyKey,
        status: 'FAILED',
        createdAt: now,
        expiresAt: now + ttlMs,
      });
      throw err;
    }
  }

  /**
   * Cleans up expired idempotency keys
   */
  static cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  static reset() {
    this.store.clear();
  }
}
