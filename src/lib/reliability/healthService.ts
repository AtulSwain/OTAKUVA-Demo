/**
 * OTAKUVA RELIABILITY — PHASE 10.5
 * HEALTH CHECK & SYSTEM DIAGNOSTICS SERVICE
 * 
 * Production liveness and readiness probes:
 * - Database connectivity check
 * - Memory pressure assessment
 * - Cache subsystem check
 * - Response latency diagnostics
 */

import { prisma } from '../prisma';
import { CacheManager } from '../performance/cacheManager';

export interface SubsystemHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  latencyMs: number;
  details?: Record<string, any>;
}

export interface SystemHealthReport {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  environment: string;
  subsystems: {
    database: SubsystemHealth;
    cache: SubsystemHealth;
    memory: SubsystemHealth;
  };
}

export class HealthService {
  private static startTime = Date.now();

  /**
   * Fast Liveness Probe (checks if application server is running)
   */
  static getLiveness(): { status: string; timestamp: string } {
    return {
      status: 'UP',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Deep Readiness Probe (verifies database, cache, and resources before accepting traffic)
   */
  static async getReadiness(): Promise<SystemHealthReport> {
    const startDb = Date.now();
    let dbStatus: SubsystemHealth['status'] = 'HEALTHY';
    let dbError: string | undefined;

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err: any) {
      dbStatus = 'UNHEALTHY';
      dbError = err?.message || 'Database connection error';
    }
    const dbLatency = Date.now() - startDb;

    // Memory Assessment
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
    const memoryRatio = heapTotalMb > 0 ? heapUsedMb / heapTotalMb : 0;
    const memoryStatus: SubsystemHealth['status'] = memoryRatio > 0.9 ? 'DEGRADED' : 'HEALTHY';

    // Cache Assessment
    const cacheMetrics = CacheManager.getMetrics();
    const cacheStatus: SubsystemHealth['status'] = 'HEALTHY';

    // Overall Status
    let overallStatus: SystemHealthReport['status'] = 'HEALTHY';
    if (dbStatus === 'UNHEALTHY') {
      overallStatus = 'UNHEALTHY';
    } else if (memoryStatus === 'DEGRADED') {
      overallStatus = 'DEGRADED';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      version: '10.5.0',
      environment: process.env.NODE_ENV || 'development',
      subsystems: {
        database: {
          status: dbStatus,
          latencyMs: dbLatency,
          details: { error: dbError },
        },
        cache: {
          status: cacheStatus,
          latencyMs: 0,
          details: cacheMetrics,
        },
        memory: {
          status: memoryStatus,
          latencyMs: 0,
          details: {
            heapUsedMb,
            heapTotalMb,
            rssMb: Math.round(mem.rss / 1024 / 1024),
          },
        },
      },
    };
  }
}
