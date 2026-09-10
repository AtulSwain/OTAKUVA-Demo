/**
 * OTAKUVA TRUST & SAFETY ENGINE
 * Monitors rating velocity bursts, reviews spam, and anomaly risk signals.
 */

import { prisma } from '../../prisma';
import { TRUST_SAFETY_CONFIG } from '../config';

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  riskScore: number;
}

/**
 * Checks if a user is submitting ratings too quickly (burst velocity anomaly)
 */
export async function validateRatingVelocity(userId: string): Promise<SafetyCheckResult> {
  const windowStart = new Date(Date.now() - TRUST_SAFETY_CONFIG.BURST_WINDOW_SECONDS * 1000);

  const recentRatingsCount = await prisma.ratingEvent.count({
    where: {
      userId,
      createdAt: { gte: windowStart },
    },
  });

  if (recentRatingsCount >= TRUST_SAFETY_CONFIG.MAX_RATINGS_PER_MINUTE) {
    // Record risk signal
    await prisma.ratingRiskSignal.create({
      data: {
        userId,
        animeId: 'GLOBAL_BURST',
        signalType: 'VELOCITY_SPIKE',
        riskScore: 0.85,
        detailsJson: JSON.stringify({ count: recentRatingsCount, windowSec: TRUST_SAFETY_CONFIG.BURST_WINDOW_SECONDS }),
        status: 'PENDING',
      },
    });

    return {
      allowed: false,
      reason: 'Rating rate limit exceeded. Please pace your ratings.',
      riskScore: 0.85,
    };
  }

  return { allowed: true, riskScore: 0.0 };
}
