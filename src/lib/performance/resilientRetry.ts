/**
 * OTAKUVA PERFORMANCE — PHASE 10.4 & 10.5
 * RESILIENT RETRY WITH EXPONENTIAL BACKOFF & JITTER
 * 
 * Bounded retry utility for transient database/network failures:
 * - Exponential backoff: delay = initialDelay * (multiplier ^ attempt)
 * - Random jitter to prevent thundering herd
 * - Configurable maximum attempt bounds
 */

export interface RetryOptions {
  maxAttempts?: number;     // Maximum total attempts (default: 3)
  initialDelayMs?: number;  // Initial backoff delay (default: 100ms)
  maxDelayMs?: number;      // Maximum backoff cap (default: 2000ms)
  multiplier?: number;      // Backoff multiplier (default: 2.0)
  shouldRetry?: (error: any) => boolean; // Custom retry condition
}

export async function withResilientRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelayMs = options.initialDelayMs || 100;
  const maxDelayMs = options.maxDelayMs || 2000;
  const multiplier = options.multiplier || 2.0;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) {
        break;
      }

      if (options.shouldRetry && !options.shouldRetry(err)) {
        break;
      }

      // Calculate backoff with jitter
      const rawDelay = initialDelayMs * Math.pow(multiplier, attempt - 1);
      const cappedDelay = Math.min(rawDelay, maxDelayMs);
      const jitter = Math.random() * 0.3 * cappedDelay; // 0-30% jitter
      const delay = cappedDelay + jitter;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
