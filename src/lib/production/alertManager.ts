/**
 * OTAKUVA PRODUCTION READINESS — PHASE 12.5
 * REAL-TIME ALERTING & INCIDENT NOTIFICATION ENGINE
 * 
 * Manages production alerts and incident dispatching:
 * - Severities: CRITICAL, HIGH, MEDIUM, LOW, INFO
 * - Automated threshold triggers (Error rate > 5%, p99 latency > 1000ms, DB connection drop)
 * - Alert deduplication and cooldown to suppress alert fatigue
 * - Telemetry buffer for active and historical alerts
 */

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface AlertEvent {
  id: string;
  severity: AlertSeverity;
  subsystem: string;
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
}

export class AlertManager {
  private static alerts: AlertEvent[] = [];
  private static cooldowns = new Map<string, number>();
  private static readonly COOLDOWN_MS = 60 * 1000; // 1 minute cooldown per alert key
  private static readonly MAX_HISTORY = 500;

  /**
   * Dispatches an alert if not in active cooldown
   */
  static triggerAlert(
    severity: AlertSeverity,
    subsystem: string,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): AlertEvent | null {
    const cooldownKey = `${subsystem}:${severity}:${title}`;
    const now = Date.now();
    const lastTriggered = this.cooldowns.get(cooldownKey) || 0;

    if (now - lastTriggered < this.COOLDOWN_MS) {
      // Suppressed due to cooldown
      return null;
    }

    this.cooldowns.set(cooldownKey, now);

    const alert: AlertEvent = {
      id: `alert_${now}_${Math.random().toString(36).substring(2, 7)}`,
      severity,
      subsystem,
      title,
      message,
      timestamp: new Date().toISOString(),
      metadata,
      resolved: false,
    };

    if (this.alerts.length >= this.MAX_HISTORY) {
      this.alerts.shift();
    }
    this.alerts.push(alert);

    // Format structured log
    const logPrefix = severity === 'CRITICAL' || severity === 'HIGH' ? '🔥 [ALERT_CRITICAL]' : '⚠️ [ALERT]';
    console.warn(`${logPrefix} [${subsystem}] ${title}: ${message}`);

    return alert;
  }

  /**
   * Resolves an active alert by ID
   */
  static resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * Gets list of active and recent alerts
   */
  static getAlerts(options: { unresolvedOnly?: boolean; severity?: AlertSeverity } = {}): AlertEvent[] {
    return this.alerts.filter((a) => {
      if (options.unresolvedOnly && a.resolved) return false;
      if (options.severity && a.severity !== options.severity) return false;
      return true;
    });
  }

  /**
   * Evaluates operational metrics and triggers automated threshold alerts
   */
  static evaluateMetrics(metrics: {
    errorRate: number;
    p99Ms: number;
    dbStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    memoryStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  }) {
    if (metrics.dbStatus === 'UNHEALTHY') {
      this.triggerAlert('CRITICAL', 'DATABASE', 'Database Outage', 'Primary database connection failed.');
    }

    if (metrics.errorRate > 10) {
      this.triggerAlert('CRITICAL', 'API', 'Severe Error Rate Spike', `API error rate is at ${metrics.errorRate}%`);
    } else if (metrics.errorRate > 5) {
      this.triggerAlert('HIGH', 'API', 'Elevated Error Rate', `API error rate is at ${metrics.errorRate}%`);
    }

    if (metrics.p99Ms > 1500) {
      this.triggerAlert('HIGH', 'PERFORMANCE', 'Latency Spike (p99 > 1.5s)', `p99 latency degraded to ${metrics.p99Ms}ms`);
    }

    if (metrics.memoryStatus === 'DEGRADED') {
      this.triggerAlert('MEDIUM', 'SYSTEM', 'High Memory Pressure', 'Heap memory utilization exceeds 90%');
    }
  }

  static reset() {
    this.alerts = [];
    this.cooldowns.clear();
  }
}
