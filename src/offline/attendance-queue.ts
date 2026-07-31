/**
 * Offline attendance queue.
 *
 * Spec 4.3: "Must work offline and sync when connectivity returns — Indian
 * ground conditions demand this."
 *
 * The design assumption is that the coach's phone has NO usable connection for
 * the whole session and gets one on the drive home. So:
 *
 *   1. Every tap writes to AsyncStorage immediately and returns. Nothing the
 *      coach does on the pitch ever waits on the network.
 *   2. Each mark carries a `clientMutationId` (the idempotency key) and
 *      `recordedAtDevice` (when the tap actually happened, not when it synced).
 *   3. `flush()` posts the whole queue per session and drops exactly the items
 *      the server acknowledged.
 *
 * The subtle part is step 3. The response to a sync is precisely what a bad
 * connection loses, so the client WILL re-send items the server already stored.
 * That is fine — the server treats `clientMutationId` as idempotent. What must
 * not happen is an item that can never succeed (a player who left the batch)
 * blocking the queue forever, which is why the server acknowledges rejections
 * too and this module drops them rather than retrying.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { api, ApiError } from '@/api/client';

const QUEUE_KEY = 'kyros.attendanceQueue.v1';

export type AttendanceMark = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface QueuedMark {
  clientMutationId: string;
  sessionId: string;
  playerProfileId: string;
  status: AttendanceMark;
  recordedAtDevice: string;
  /** Retry count, so a persistently failing item can be surfaced to the coach. */
  attempts: number;
  lastError?: string;
}

interface SyncResponse {
  applied: number;
  duplicates: number;
  superseded: number;
  rejected: Array<{ clientMutationId: string; reason: string }>;
  acknowledgedMutationIds: string[];
}

export interface FlushResult {
  synced: number;
  rejected: Array<{ clientMutationId: string; reason: string }>;
  remaining: number;
  /** True when the flush stopped because the device is offline. */
  offline: boolean;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function readQueue(): Promise<QueuedMark[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMark[]) : [];
  } catch {
    // A corrupted queue is worse than an empty one — it would block every
    // future sync. Losing unsynced marks is bad; never syncing again is worse.
    console.warn('[attendance-queue] queue was unreadable and has been reset');
    return [];
  }
}

async function writeQueue(queue: QueuedMark[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// ---------------------------------------------------------------------------
// Enqueue
// ---------------------------------------------------------------------------

/**
 * Record a mark. Returns as soon as it is on disk — never awaits the network.
 *
 * Re-marking the same player in the same session REPLACES the queued entry
 * rather than adding a second. A coach correcting a mistap should not produce
 * two competing writes for the server to reconcile.
 */
export async function enqueueMark(params: {
  sessionId: string;
  playerProfileId: string;
  status: AttendanceMark;
}): Promise<QueuedMark> {
  const queue = await readQueue();

  const existingIndex = queue.findIndex(
    (item) =>
      item.sessionId === params.sessionId && item.playerProfileId === params.playerProfileId,
  );

  const mark: QueuedMark = {
    // A fresh id per tap: the correction is a genuinely new mutation, and
    // reusing the old id would let the server dedupe it away as a replay.
    clientMutationId: Crypto.randomUUID(),
    sessionId: params.sessionId,
    playerProfileId: params.playerProfileId,
    status: params.status,
    recordedAtDevice: new Date().toISOString(),
    attempts: 0,
  };

  if (existingIndex >= 0) {
    queue[existingIndex] = mark;
  } else {
    queue.push(mark);
  }

  await writeQueue(queue);
  return mark;
}

/** Marks queued for one session — the source of truth for the roster UI. */
export async function pendingForSession(sessionId: string): Promise<Map<string, AttendanceMark>> {
  const queue = await readQueue();
  return new Map(
    queue
      .filter((item) => item.sessionId === sessionId)
      .map((item) => [item.playerProfileId, item.status]),
  );
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

export async function pendingMarks(): Promise<QueuedMark[]> {
  return readQueue();
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

/** Serialised so a manual flush and an automatic one cannot double-post. */
let flushInFlight: Promise<FlushResult> | null = null;

export function flush(): Promise<FlushResult> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = doFlush().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

async function doFlush(): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { synced: 0, rejected: [], remaining: 0, offline: false };
  }

  // One request per session, since that is what the endpoint is scoped to.
  const bySession = new Map<string, QueuedMark[]>();
  for (const mark of queue) {
    const list = bySession.get(mark.sessionId) ?? [];
    list.push(mark);
    bySession.set(mark.sessionId, list);
  }

  const acknowledged = new Set<string>();
  const rejected: FlushResult['rejected'] = [];
  const failedIds = new Set<string>();
  let offline = false;
  let synced = 0;

  for (const [sessionId, marks] of bySession) {
    try {
      const result = await api.post<SyncResponse>(`/api/v1/sessions/${sessionId}/attendance`, {
        entries: marks.map((mark) => ({
          playerProfileId: mark.playerProfileId,
          status: mark.status,
          recordedAtDevice: mark.recordedAtDevice,
          clientMutationId: mark.clientMutationId,
        })),
      });

      for (const id of result.acknowledgedMutationIds) acknowledged.add(id);
      rejected.push(...result.rejected);
      synced += result.applied + result.duplicates + result.superseded;
    } catch (error) {
      if (error instanceof ApiError && error.isOffline) {
        // Still no connection. Stop entirely — the remaining sessions will
        // fail the same way and hammering the radio drains the battery.
        offline = true;
        break;
      }

      // A non-network failure (a 500, an expired session, a permissions
      // change) keeps the marks queued but counts the attempt, so the UI can
      // eventually tell the coach something is genuinely wrong.
      const message = error instanceof Error ? error.message : 'Sync failed.';
      for (const mark of marks) {
        failedIds.add(mark.clientMutationId);
        mark.attempts += 1;
        mark.lastError = message;
      }
    }
  }

  const remaining = queue.filter((mark) => !acknowledged.has(mark.clientMutationId));
  await writeQueue(remaining);

  return { synced, rejected, remaining: remaining.length, offline };
}

/** Development affordance — never wire this to a user-facing button. */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
