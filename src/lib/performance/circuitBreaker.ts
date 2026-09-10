/**
 * OTAKUVA PERFORMANCE — PHASE 10.4 & 10.5
 * CIRCUIT BREAKER PATTERN ENGINE
 * 
 * Protects OTAKUVA from cascading failures when third-party or external services degrade:
 * - States: CLOSED (normal), OPEN (tripped / fast-fail), HALF_OPEN (probe trial)
 * - Automatic recovery after cooldown timeout
 * - Graceful fallback execution
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Consecutive failures before tripping to OPEN (default: 5)
  resetTimeoutMs?: number;   // Time to wait before testing recovery in HALF_OPEN (default: 30s)
}

export class CircuitBreaker {
  private name: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 30 * 1000;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  /**
   * Executes an asynchronous operation wrapped with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      if (fallback) {
        return fallback();
      }
      throw new Error(`CircuitBreaker [${this.name}] is OPEN. Fast-failing operation to protect service.`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      if (fallback) {
        return fallback();
      }
      throw err;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
