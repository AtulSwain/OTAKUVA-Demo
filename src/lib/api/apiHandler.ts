/**
 * OTAKUVA API HANDLER & OBSERVABILITY WRAPPER
 * 
 * Central wrapper for all Next.js App Router API handlers.
 * Enforces standardized envelopes, execution timing, security headers,
 * error normalization, and performance metrics tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse, PaginationMeta } from '../contracts/apiContracts';
import { getSecurityHeaders } from '../security/securityHeaders';
import { PerformanceMetrics } from '../performance/performanceMetrics';
import { logger } from '../logger';
import { attachSentryUser } from '../observability/sentryUser';
import { getUserIdFromRequestFast } from '../auth';

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface ApiHandlerOptions {
  requireAuth?: boolean;
  rateLimitKey?: string;
  cacheTtlSeconds?: number;
}

/**
 * Creates a standard successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: PaginationMeta,
  cached = false,
  startTime?: number,
  extraProps: Record<string, any> = {}
): NextResponse {
  const executionTimeMs = startTime ? Math.round(performance.now() - startTime) : 0;

  const payload: ApiResponse<T> = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
    cached,
    executionTimeMs,
    error: null,
    ...extraProps,
  };

  const response = NextResponse.json(payload, { status: 200 });
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  if (cached) {
    response.headers.set('X-Otakuva-Cache', 'HIT');
  } else {
    response.headers.set('X-Otakuva-Cache', 'MISS');
  }
  response.headers.set('X-Response-Time-Ms', executionTimeMs.toString());

  return response;
}

/**
 * Creates a standard error API response
 */
export function createErrorResponse(
  message: string,
  statusCode = 500,
  code = 'INTERNAL_ERROR',
  details?: any,
  startTime?: number
): NextResponse {
  const executionTimeMs = startTime ? Math.round(performance.now() - startTime) : 0;

  const payload: ApiResponse<null> = {
    success: false,
    data: null,
    executionTimeMs,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      timestamp: new Date().toISOString(),
    },
  };

  const response = NextResponse.json(payload, { status: statusCode });
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  response.headers.set('X-Response-Time-Ms', executionTimeMs.toString());

  return response;
}

/**
 * High-order function that wraps a Next.js route handler.
 *
 * Observability, on every call regardless of outcome:
 *   - a structured request-completion log line (route, method, status,
 *     latencyMs, userId when authenticated — see src/lib/logger.ts),
 *   - the authenticated user id (only the id) attached to the Sentry
 *     scope for the duration of the request (src/lib/observability/
 *     sentryUser.ts), so any error captured — here or by Next.js's
 *     onRequestError backstop in src/instrumentation.ts for routes that
 *     don't use this wrapper — carries it,
 *   - for any error that isn't an expected ApiError (a 4xx ApiError is
 *     normal control flow, e.g. a validation failure — not something
 *     error tracking needs to know about), log.error(...) reports it to
 *     Sentry with route/method/handler tags — see src/lib/logger.ts,
 *     which is the single place a warn/error reaches Sentry from, so it
 *     never gets reported twice from both a log call and an explicit
 *     Sentry.captureException side by side.
 */
export function withApiHandler(
  handlerName: string,
  fn: (req: NextRequest, context?: any) => Promise<NextResponse | { data?: any; meta?: PaginationMeta; cached?: boolean; [key: string]: any }>
) {
  return async function (request: NextRequest, context?: any): Promise<NextResponse> {
    const startTime = performance.now();
    const endpointPath = request.nextUrl.pathname;
    const method = request.method;
    const userId = getUserIdFromRequestFast(request);
    const log = logger.child({ route: endpointPath, method, handler: handlerName, ...(userId ? { userId } : {}) });

    attachSentryUser(request);

    try {
      const result = await fn(request, context);

      // If handler returned a raw NextResponse directly, attach headers & telemetry
      if (result instanceof NextResponse) {
        const headers = getSecurityHeaders();
        for (const [key, value] of Object.entries(headers)) {
          if (!result.headers.has(key)) {
            result.headers.set(key, value);
          }
        }
        const duration = Math.round(performance.now() - startTime);
        result.headers.set('X-Response-Time-Ms', duration.toString());
        PerformanceMetrics.recordApiCall(endpointPath, duration, result.status);
        log.withStatus(result.status).withLatency(duration).info('request completed');
        return result;
      }

      // If handler returned an object with data
      const duration = Math.round(performance.now() - startTime);
      PerformanceMetrics.recordApiCall(endpointPath, duration, 200);
      log.withStatus(200).withLatency(duration).info('request completed');

      const { data, meta, cached, ...extra } = result;
      return createSuccessResponse(data, meta, Boolean(cached), startTime, extra);
    } catch (error: any) {
      const duration = Math.round(performance.now() - startTime);

      if (error instanceof ApiError) {
        PerformanceMetrics.recordApiCall(endpointPath, duration, error.statusCode);
        log.withStatus(error.statusCode).withLatency(duration).warn('request failed (expected)', { code: error.code, message: error.message });
        return createErrorResponse(error.message, error.statusCode, error.code, error.details, startTime);
      }

      PerformanceMetrics.recordApiCall(endpointPath, duration, 500);
      log.withStatus(500).withLatency(duration).error('unhandled request error', {
        error,
        tags: { route: endpointPath, method, handler: handlerName },
      });

      return createErrorResponse(
        error?.message || 'An unexpected server error occurred',
        500,
        'INTERNAL_SERVER_ERROR',
        process.env.NODE_ENV === 'development' ? error?.stack : undefined,
        startTime
      );
    }
  };
}
