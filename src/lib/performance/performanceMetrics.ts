/**
 * OTAKUVA PERFORMANCE — PHASE 10.4 & 10.5
 * REAL-TIME PERFORMANCE METRICS & LATENCY TRACKER
 * 
 * In-memory sliding window performance metrics:
 * - Computes p50, p95, p99, mean latency
 * - Tracks requests/second, error rate (4xx/5xx)
 * - Identifies slow requests (> 500ms) for observability
 */

interface LatencyRecord {
  timestamp: number;
  durationMs: number;
  statusCode: number;
  route: string;
}

export class PerformanceMetrics {
  private static records: LatencyRecord[] = [];
  private static readonly MAX_RECORDS = 5000;
  private static readonly WINDOW_MS = 60 * 1000; // 1 minute sliding window

  /**
   * Records an API request execution
   */
  static recordRequest(route: string, durationMs: number, statusCode = 200) {
    if (this.records.length >= this.MAX_RECORDS) {
      this.records.shift();
    }
    this.records.push({
      timestamp: Date.now(),
      durationMs,
      statusCode,
      route,
    });
  }

  /**
   * Alias for recordRequest for API telemetry
   */
  static recordApiCall(route: string, durationMs: number, statusCode = 200) {
    this.recordRequest(route, durationMs, statusCode);
  }

  /**
   * Computes percentile latency from a sorted list of durations
   */
  private static getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return parseFloat(sorted[Math.max(0, index)].toFixed(2));
  }

  /**
   * Returns current performance statistics
   */
  static getStats(): {
    sampleCount: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    errorRate: number;
    slowRequestCount: number;
    statusDistribution: { success: number; clientError: number; serverError: number };
  } {
    const cutoff = Date.now() - this.WINDOW_MS;
    const recent = this.records.filter((r) => r.timestamp >= cutoff);
    const count = recent.length;

    if (count === 0) {
      return {
        sampleCount: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        errorRate: 0,
        slowRequestCount: 0,
        statusDistribution: { success: 0, clientError: 0, serverError: 0 },
      };
    }

    const durations = recent.map((r) => r.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, val) => acc + val, 0);

    let success = 0;
    let clientError = 0;
    let serverError = 0;
    let slowCount = 0;

    for (const r of recent) {
      if (r.statusCode >= 500) serverError++;
      else if (r.statusCode >= 400) clientError++;
      else success++;

      if (r.durationMs > 500) slowCount++;
    }

    const totalErrors = clientError + serverError;
    const errorRate = parseFloat(((totalErrors / count) * 100).toFixed(2));

    return {
      sampleCount: count,
      p50Ms: this.getPercentile(durations, 50),
      p95Ms: this.getPercentile(durations, 95),
      p99Ms: this.getPercentile(durations, 99),
      avgMs: parseFloat((sum / count).toFixed(2)),
      minMs: parseFloat(durations[0].toFixed(2)),
      maxMs: parseFloat(durations[durations.length - 1].toFixed(2)),
      errorRate,
      slowRequestCount: slowCount,
      statusDistribution: { success, clientError, serverError },
    };
  }

  /**
   * Resets stored performance samples
   */
  static reset() {
    this.records = [];
  }
}
