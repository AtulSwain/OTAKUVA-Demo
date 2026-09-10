/**
 * OTAKUVA NEWS PROVIDER HTTP CLIENT (PHASE 8.2)
 * 
 * Production Provider Client:
 * - Configurable request timeouts via AbortController
 * - Rate limit throttling & Retry-After handling
 * - Exponential backoff with jitter
 * - Standardized Provider Error normalization
 * - Active health check probes & latency measurement
 */

import { ProviderError, ProviderErrorCode, ProviderHealthStatus } from './newsTypes';

export interface RequestOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  retries?: number;
  retryDelayMs?: number;
}

export class NewsProviderClient {
  private defaultTimeoutMs: number;
  private lastRequestTime: Map<string, number> = new Map();
  private minRequestIntervalMs: number = 300; // Throttles outbound provider requests (max ~200 req/min)

  constructor(defaultTimeoutMs = 8000) {
    const envTimeout = process.env.NEWS_PROVIDER_TIMEOUT ? parseInt(process.env.NEWS_PROVIDER_TIMEOUT, 10) : NaN;
    this.defaultTimeoutMs = !isNaN(envTimeout) && envTimeout > 0 ? envTimeout : defaultTimeoutMs;
  }

  /**
   * Executes a robust HTTP GET request to a provider endpoint with throttling, timeouts, and retries
   */
  async get<T = any>(url: string, providerName: string, options: RequestOptions = {}): Promise<T> {
    const { timeoutMs = this.defaultTimeoutMs, headers = {}, retries = 2, retryDelayMs = 1000 } = options;

    // Apply Rate Limit Throttling
    await this.throttle(providerName);

    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'OTAKUVA-NewsIngestionEngine/2.0 (+https://otakuva.com)',
            Accept: 'application/json, application/xml, text/xml, application/rss+xml, text/plain',
            ...headers,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : undefined;

          if (response.status === 429) {
            throw this.createProviderError('PROVIDER_RATE_LIMITED', `Rate limited by ${providerName}`, response.status, providerName, retryAfterMs);
          } else if (response.status === 401 || response.status === 403) {
            throw this.createProviderError('PROVIDER_UNAUTHORIZED', `Unauthorized access to ${providerName}`, response.status, providerName);
          } else if (response.status === 503 || response.status === 502 || response.status === 504) {
            throw this.createProviderError('PROVIDER_UNAVAILABLE', `${providerName} service temporarily unavailable (${response.status})`, response.status, providerName);
          } else {
            throw this.createProviderError('PROVIDER_SERVER_ERROR', `${providerName} responded with HTTP ${response.status}`, response.status, providerName);
          }
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return await response.json();
        } else {
          const text = await response.text();
          return text as unknown as T;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);

        let providerErr: ProviderError;
        if (err.name === 'AbortError') {
          providerErr = this.createProviderError('PROVIDER_TIMEOUT', `Request to ${providerName} timed out after ${timeoutMs}ms`, 408, providerName);
        } else if (err.code && err.provider) {
          providerErr = err as ProviderError;
        } else {
          providerErr = this.createProviderError('PROVIDER_UNAVAILABLE', `Network error connecting to ${providerName}: ${err.message}`, 503, providerName);
        }

        lastError = providerErr;

        // Only retry retryable errors (timeouts, 429, 503)
        const isRetryable =
          providerErr.code === 'PROVIDER_TIMEOUT' ||
          providerErr.code === 'PROVIDER_RATE_LIMITED' ||
          providerErr.code === 'PROVIDER_UNAVAILABLE';

        if (attempt < retries && isRetryable) {
          const waitTime = providerErr.retryAfterMs || retryDelayMs * Math.pow(2, attempt);
          await new Promise((res) => setTimeout(res, waitTime));
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  /**
   * Performs an active health check on a provider URL
   */
  async probeHealth(
    url: string,
    providerName: string
  ): Promise<{ status: ProviderHealthStatus; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.get(url, providerName, { timeoutMs: 4000, retries: 0 });
      return {
        status: 'HEALTHY',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const status: ProviderHealthStatus = err.code === 'PROVIDER_RATE_LIMITED' ? 'DEGRADED' : 'FAILED';
      return {
        status,
        latencyMs,
        error: err.message,
      };
    }
  }

  private async throttle(providerName: string): Promise<void> {
    const now = Date.now();
    const last = this.lastRequestTime.get(providerName) || 0;
    const elapsed = now - last;

    if (elapsed < this.minRequestIntervalMs) {
      await new Promise((res) => setTimeout(res, this.minRequestIntervalMs - elapsed));
    }

    this.lastRequestTime.set(providerName, Date.now());
  }

  private createProviderError(
    code: ProviderErrorCode,
    message: string,
    statusCode: number | undefined,
    provider: string,
    retryAfterMs?: number
  ): ProviderError {
    return {
      code,
      message,
      statusCode,
      provider,
      retryAfterMs,
    };
  }
}

export const newsProviderClient = new NewsProviderClient();
