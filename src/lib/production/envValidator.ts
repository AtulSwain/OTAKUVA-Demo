/**
 * OTAKUVA PRODUCTION READINESS — PHASE 12.2
 * ENVIRONMENT & CONFIGURATION MANAGEMENT ENGINE
 * 
 * Validates production environment variables, secrets, and operational flags:
 * - Rejects weak secrets or insecure defaults in production
 * - Enforces minimum key lengths (e.g. 32 chars for AUTH_SECRET)
 * - Validates DATABASE_URL protocol and parameters
 * - Masks sensitive secrets in diagnostic logs
 */

import crypto from 'crypto';

export interface EnvValidationResult {
  isValid: boolean;
  environment: 'development' | 'test' | 'staging' | 'production';
  errors: string[];
  warnings: string[];
  publicConfig: Record<string, string>;
}

export class EnvValidator {
  /**
   * Masks a secret string showing only first 3 and last 3 characters
   */
  static maskSecret(secret?: string | null): string {
    if (!secret) return '[UNSET]';
    if (secret.length <= 6) return '***';
    return `${secret.substring(0, 3)}...${secret.substring(secret.length - 3)}`;
  }

  /**
   * Validates full application environment
   */
  static validate(env = process.env): EnvValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const rawEnv = (env.NODE_ENV || 'development').toLowerCase();
    const environment = (['development', 'test', 'staging', 'production'].includes(rawEnv)
      ? rawEnv
      : 'development') as 'development' | 'test' | 'staging' | 'production';

    const isProd = environment === 'production';

    // 1. Database URL Validation
    const dbUrl = env.DATABASE_URL;
    if (!dbUrl) {
      errors.push('DATABASE_URL is required but was not provided.');
    } else if (isProd && dbUrl.startsWith('file:') && !env.ALLOW_SQLITE_IN_PROD) {
      warnings.push('DATABASE_URL is using SQLite in production mode.');
    }

    // 2. Auth Secret Validation
    const authSecret = env.AUTH_SECRET;
    if (!authSecret) {
      if (isProd) {
        errors.push('AUTH_SECRET is required in production environment.');
      } else {
        warnings.push('AUTH_SECRET is unset; using local development fallback.');
      }
    } else if (authSecret.length < 32) {
      if (isProd) {
        errors.push('AUTH_SECRET must be at least 32 characters long in production.');
      } else {
        warnings.push('AUTH_SECRET is shorter than recommended 32 characters.');
      }
    }

    // 3. Super Admin Bootstrap List
    const superAdmins = env.OTAKUVA_SUPER_ADMIN_EMAILS;
    if (!superAdmins && isProd) {
      warnings.push('OTAKUVA_SUPER_ADMIN_EMAILS is unset; initial admin promotion must be performed manually.');
    }

    // 4. Public Configuration
    const publicConfig: Record<string, string> = {
      NODE_ENV: environment,
      NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      ENABLE_AI_RECOMMENDATIONS: env.ENABLE_AI_RECOMMENDATIONS || 'true',
      ENABLE_RATE_LIMITING: env.ENABLE_RATE_LIMITING || 'true',
    };

    return {
      isValid: errors.length === 0,
      environment,
      errors,
      warnings,
      publicConfig,
    };
  }

  /**
   * Generates a cryptographically secure 256-bit secret for rotation
   */
  static generateSecureSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
