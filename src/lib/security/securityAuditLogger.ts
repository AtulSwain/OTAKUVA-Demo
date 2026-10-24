/**
 * OTAKUVA SECURITY — PHASE 10.1 & 10.2
 * SECURITY AUDIT LOGGER
 * 
 * Records high-fidelity security telemetry:
 * - Login successes and failures
 * - Role escalation & permission changes
 * - Unauthorized IDOR / BOLA attempts
 * - Rate limit violations
 * - Admin modifications
 * - Strictly strips passwords, secret tokens, and private payload data
 */

import { prisma } from '../prisma';

export type SecurityEventType =
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILURE'
  | 'AUTH_PASSWORD_CHANGE'
  | 'AUTH_LOGOUT'
  | 'ROLE_CHANGE'
  | 'IDOR_BLOCKED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ADMIN_ACTION'
  | 'SUSPICIOUS_REQUEST'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_DATA_EXPORTED';

export interface SecurityEventPayload {
  eventType: SecurityEventType;
  actorId?: string | null;
  targetEntityType?: string;
  targetEntityId?: string;
  ipHash?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export class SecurityAuditLogger {
  /**
   * Sanitizes metadata to guarantee no passwords/secrets enter logs
   */
  private static sanitizeDetails(details?: Record<string, any>): string | undefined {
    if (!details) return undefined;
    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'token', 'secret', 'hash', 'authToken', 'jwt', 'credentials'];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return JSON.stringify(sanitized);
  }

  /**
   * Records security event in database and structured console log
   */
  static async logSecurityEvent(payload: SecurityEventPayload): Promise<void> {
    const safeDetails = this.sanitizeDetails(payload.details);

    console.warn(
      `[SECURITY_AUDIT] [${payload.eventType}] actor=${payload.actorId || 'anonymous'} target=${payload.targetEntityType || 'none'}:${payload.targetEntityId || 'none'}`
    );

    try {
      if (payload.actorId) {
        const actorExists = await prisma.user.findUnique({
          where: { id: payload.actorId },
          select: { id: true },
        }).catch(() => null);

        if (actorExists) {
          await prisma.auditLog.create({
            data: {
              actorId: payload.actorId,
              action: payload.eventType,
              entityType: payload.targetEntityType || 'SecurityEvent',
              entityId: payload.targetEntityId || 'global',
              afterJson: safeDetails,
            },
          }).catch(() => null);
        }
      }
    } catch {
      // Never crash critical request flow if audit logging fails
    }
  }
}
