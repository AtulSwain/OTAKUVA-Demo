/**
 * OTAKUVA ENGINE — PHASE 10.1
 * USER BEHAVIORAL INTELLIGENCE & EVENT TRACKING SERVICE
 * 
 * Centralized, validated, append-oriented behavioral telemetry and event stream:
 * - Server-side validation (bounds checking, entity integrity, user identity)
 * - Idempotency & deduplication protection
 * - Rich interaction capture (Watch depth, skips, rewatches, ratings, search intent, recommendation actions)
 * - Controlled time-decay signal accumulation
 * - Safe async dispatcher to User Taste Engine
 */

import { prisma } from '../../prisma';
import { eventEngine } from './eventEngine';
import { EngineEventType, EntityType } from './eventTypes';

export interface TrackBehaviorEventInput {
  eventType: EngineEventType;
  userId: string;
  entityType: EntityType;
  entityId: string;
  metadata?: Record<string, any>;
  version?: number;
  idempotencyKey?: string;
}

export interface TrackBehaviorResult {
  success: boolean;
  eventId: string;
  isDuplicate?: boolean;
  validationError?: string;
}

export class BehavioralTrackingService {
  private recentEventKeys: Map<string, number> = new Map();
  private readonly IDEMPOTENCY_WINDOW_MS = 3000; // 3 seconds deduplication window

  /**
   * Validates event payload integrity, ranges, and types
   */
  validateEvent(input: TrackBehaviorEventInput): { isValid: boolean; error?: string } {
    if (!input.userId || typeof input.userId !== 'string') {
      return { isValid: false, error: 'User ID is required and must be a valid string.' };
    }

    if (!input.entityId || typeof input.entityId !== 'string') {
      return { isValid: false, error: 'Entity ID is required.' };
    }

    if (!input.eventType) {
      return { isValid: false, error: 'Event type is required.' };
    }

    // Specific field validation rules
    const meta = input.metadata || {};

    if (input.eventType === 'ANIME_RATED' || input.eventType === 'EPISODE_RATED' || input.eventType === 'ANIME_RATING_UPDATED') {
      const rating = meta.rating !== undefined ? meta.rating : meta.score;
      if (typeof rating !== 'number' || isNaN(rating) || rating < 0 || rating > 10) {
        return { isValid: false, error: `Invalid rating score: ${rating}. Rating must be between 0.0 and 10.0.` };
      }
    }

    if (input.eventType === 'EPISODE_PROGRESS') {
      const progress = meta.progressPercent ?? meta.progress;
      if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
        return { isValid: false, error: `Invalid progress percent: ${progress}. Must be between 0 and 100.` };
      }
    }

    return { isValid: true };
  }

  /**
   * Generates a deterministic idempotency key
   */
  private generateIdempotencyKey(input: TrackBehaviorEventInput): string {
    if (input.idempotencyKey) return input.idempotencyKey;
    const metaDigest = input.metadata ? JSON.stringify(input.metadata) : '';
    return `${input.userId}:${input.eventType}:${input.entityId}:${metaDigest}`;
  }

  /**
   * Records a behavioral event with server-side validation and idempotency
   */
  async trackEvent(input: TrackBehaviorEventInput): Promise<TrackBehaviorResult> {
    const validation = this.validateEvent(input);
    if (!validation.isValid) {
      return {
        success: false,
        eventId: 'invalid_event',
        validationError: validation.error,
      };
    }

    // Check recent duplicate events (idempotency)
    const key = this.generateIdempotencyKey(input);
    const now = Date.now();
    const lastSeen = this.recentEventKeys.get(key);

    if (lastSeen && now - lastSeen < this.IDEMPOTENCY_WINDOW_MS) {
      return {
        success: true,
        eventId: 'idempotent_cached',
        isDuplicate: true,
      };
    }
    this.recentEventKeys.set(key, now);

    // Garbage-collect old keys periodically
    if (this.recentEventKeys.size > 1000) {
      for (const [k, ts] of this.recentEventKeys.entries()) {
        if (now - ts > this.IDEMPOTENCY_WINDOW_MS * 2) {
          this.recentEventKeys.delete(k);
        }
      }
    }

    // Persist via Centralized Event Engine
    const eventRecord = await eventEngine.emit({
      eventType: input.eventType,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: {
        ...input.metadata,
        clientTimestamp: new Date().toISOString(),
      },
      version: input.version || 1,
    });

    return {
      success: true,
      eventId: eventRecord.id,
      isDuplicate: false,
    };
  }

  /**
   * Helper: Track Episode Watch Progress
   */
  async trackWatchProgress(userId: string, animeId: string, episodeId: string, progressPercent: number, secondsWatched?: number) {
    return this.trackEvent({
      eventType: 'EPISODE_PROGRESS',
      userId,
      entityType: 'EPISODE',
      entityId: episodeId,
      metadata: {
        animeId,
        progressPercent: Math.min(100, Math.max(0, progressPercent)),
        secondsWatched,
      },
    });
  }

  /**
   * Helper: Track Anime Search Intent
   */
  async trackSearchIntent(userId: string, query: string, filters?: Record<string, any>) {
    return this.trackEvent({
      eventType: 'ANIME_SEARCHED',
      userId,
      entityType: 'ANIME',
      entityId: 'search_query',
      metadata: {
        query: query.trim(),
        filters,
      },
    });
  }

  /**
   * Helper: Track Recommendation Feedback Action
   */
  async trackRecommendationAction(
    userId: string,
    animeId: string,
    action: 'CLICKED' | 'DISMISSED' | 'MORE_LIKE_THIS' | 'LESS_LIKE_THIS' | 'NOT_INTERESTED' | 'STARTED',
    context = 'HOME'
  ) {
    const eventTypeMap: Record<string, EngineEventType> = {
      CLICKED: 'RECOMMENDATION_CLICKED',
      DISMISSED: 'RECOMMENDATION_DISMISSED',
      MORE_LIKE_THIS: 'RECOMMENDATION_MORE_LIKE_THIS',
      LESS_LIKE_THIS: 'RECOMMENDATION_LESS_LIKE_THIS',
      NOT_INTERESTED: 'RECOMMENDATION_NOT_INTERESTED',
      STARTED: 'RECOMMENDATION_STARTED',
    };

    const eventType = eventTypeMap[action] || 'RECOMMENDATION_CLICKED';

    // Persist to RecommendationFeedback table
    await prisma.recommendationFeedback.upsert({
      where: { userId_animeId_feedback: { userId, animeId, feedback: action } },
      create: {
        userId,
        animeId,
        feedback: action,
        context,
      },
      update: {
        context,
        createdAt: new Date(),
      },
    }).catch(() => {});

    return this.trackEvent({
      eventType,
      userId,
      entityType: 'ANIME',
      entityId: animeId,
      metadata: { action, context },
    });
  }
}

export const behavioralTrackingService = new BehavioralTrackingService();
