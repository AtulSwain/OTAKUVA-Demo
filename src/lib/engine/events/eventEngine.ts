/**
 * OTAKUVA EVENT ENGINE
 * Unified event stream for tracking, intelligence, activity, and analytics.
 */

import { prisma } from '../../prisma';
import { EngineEventPayload, EngineEventType } from './eventTypes';

type EventListener = (event: EngineEventPayload & { id: string; createdAt: Date }) => Promise<void> | void;

const listeners: Map<EngineEventType | '*', EventListener[]> = new Map();

/**
 * Register an event listener for background processing
 */
export function registerEventListener(eventType: EngineEventType | '*', listener: EventListener) {
  const current = listeners.get(eventType) || [];
  current.push(listener);
  listeners.set(eventType, current);
}

/**
 * Emits a standardized engine event, persists it to EventLog, and dispatches to listeners
 */
export async function emitEngineEvent(payload: EngineEventPayload) {
  const { eventType, userId, entityType, entityId, metadata = {}, version = 1 } = payload;

  try {
    const eventRecord = await prisma.eventLog.create({
      data: {
        eventType,
        userId,
        entityType,
        entityId,
        metadata: JSON.stringify(metadata),
        version,
      },
    });

    const eventData = {
      ...payload,
      id: eventRecord.id,
      createdAt: eventRecord.createdAt,
    };

    // Dispatch to specific listeners and wildcard listeners
    const specificListeners = listeners.get(eventType) || [];
    const wildcardListeners = listeners.get('*') || [];
    const allListeners = [...specificListeners, ...wildcardListeners];

    // Execute asynchronously
    Promise.allSettled(allListeners.map((l) => l(eventData))).catch((err) => {
      console.error('[EventEngine] Error in listener execution:', err);
    });

    return eventRecord;
  } catch (error) {
    console.error('[EventEngine] Failed to persist event:', error);
    return {
      id: 'event_fallback',
      eventType,
      userId,
      entityType,
      entityId,
      metadata: JSON.stringify(metadata),
      version,
      createdAt: new Date(),
    };
  }
}

/**
 * Reusable EventService object
 */
export const EventService = {
  create: emitEngineEvent,
  register: registerEventListener,
};

export const eventEngine = {
  emit: emitEngineEvent,
  register: registerEventListener,
};
