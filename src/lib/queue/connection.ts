/**
 * OTAKUVA — Redis connections for BullMQ.
 *
 * Two separate connections, not one shared instance:
 *   - `getProducerRedisConnection()` — used by the Queue side (`.add()`,
 *     `.upsertJobScheduler()` — everything an API route or script that
 *     *enqueues* work does). Keeps ioredis's normal finite retry/backoff so
 *     a request fails fast (and the route can return a clear 503) if Redis
 *     is unreachable, instead of the request hanging forever.
 *   - `getWorkerRedisConnection()` — used by the Worker
 *     (scripts/worker.ts) and anything reading BullMQ job state. BullMQ
 *     requires `maxRetriesPerRequest: null` here — the Worker's blocking
 *     commands (BRPOPLPUSH-style) need to wait out a Redis blip rather
 *     than erroring, which is exactly what would make an *enqueueing*
 *     request hang if it shared this connection instead.
 * See https://docs.bullmq.io/guide/going-to-production#maxretriesperrequest.
 */

import IORedis from 'ioredis';
import { logger } from '../logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let producerConnection: IORedis | null = null;
let workerConnection: IORedis | null = null;

export function getProducerRedisConnection(): IORedis {
  if (!producerConnection) {
    producerConnection = new IORedis(REDIS_URL, {
      // Fail a command after a handful of retries rather than hanging the
      // HTTP request indefinitely when Redis is unreachable.
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 2000)),
    });
    producerConnection.on('error', (err) => {
      logger.error('producer Redis connection error', { error: err, component: 'queue/connection' });
    });
  }
  return producerConnection;
}

export function getWorkerRedisConnection(): IORedis {
  if (!workerConnection) {
    workerConnection = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ Worker/QueueEvents
      retryStrategy: (times) => Math.min(times * 500, 10_000),
    });
    workerConnection.on('error', (err) => {
      logger.error('worker Redis connection error', { error: err, component: 'queue/connection' });
    });
  }
  return workerConnection;
}

/** Used by cooperative-cancel flag reads/writes (src/lib/queue/handlers.ts) — either connection works; producer's fail-fast retry policy fits these short-lived commands better. */
export const getRedisConnection = getProducerRedisConnection;
