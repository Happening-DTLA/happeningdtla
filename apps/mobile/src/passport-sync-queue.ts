import type { Stamp } from "@dtlahappening/core";

export interface PassportQueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PassportSyncResult {
  sent: number;
  remaining: number;
}

interface QueueOptions {
  storage: PassportQueueStorage;
  send: (stamp: Stamp) => Promise<void>;
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = "passport/sync-queue/v1";

function stampKey(stamp: Stamp): string {
  return `${stamp.nightId}:${stamp.venueId}`;
}

function parseQueue(raw: string | null): Stamp[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (value): value is Stamp =>
        typeof value === "object" &&
        value !== null &&
        typeof (value as Stamp).venueId === "string" &&
        typeof (value as Stamp).nightId === "string" &&
        typeof (value as Stamp).at === "string" &&
        typeof (value as Stamp).verified === "boolean",
    );
  } catch {
    return [];
  }
}

/**
 * A serialized, durable outbox for anonymous passport reports.
 *
 * AsyncStorage has no compare-and-swap operation. Keeping every read-modify-
 * write and drain on one promise chain prevents a newly queued stamp from being
 * overwritten by a drain that started with an older snapshot. A crash after a
 * successful request but before the queue write can resend one item; the API's
 * unique device/venue/night key is deliberately the final idempotency guard.
 */
export function createPassportSyncQueue({
  storage,
  send,
  storageKey = DEFAULT_STORAGE_KEY,
}: QueueOptions) {
  let operations: Promise<void> = Promise.resolve();

  function exclusively<T>(operation: () => Promise<T>): Promise<T> {
    const result = operations.then(operation, operation);
    operations = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const read = async () => parseQueue(await storage.getItem(storageKey));
  const write = (queue: Stamp[]) => storage.setItem(storageKey, JSON.stringify(queue));

  return {
    enqueue(stamp: Stamp): Promise<number> {
      return exclusively(async () => {
        const queue = await read();
        if (!queue.some((queued) => stampKey(queued) === stampKey(stamp))) {
          queue.push(stamp);
          await write(queue);
        }
        return queue.length;
      });
    },

    discard(venueId: string, nightId: string): Promise<void> {
      return exclusively(async () => {
        const queue = await read();
        const next = queue.filter(
          (stamp) => stamp.venueId !== venueId || stamp.nightId !== nightId,
        );
        if (next.length !== queue.length) await write(next);
      });
    },

    drain(): Promise<PassportSyncResult> {
      return exclusively(async () => {
        const queue = await read();
        let sent = 0;

        for (let index = 0; index < queue.length; index += 1) {
          try {
            await send(queue[index]!);
            sent += 1;
          } catch {
            const remaining = queue.slice(index);
            await write(remaining);
            return { sent, remaining: remaining.length };
          }
        }

        if (queue.length > 0) await write([]);
        return { sent, remaining: 0 };
      });
    },

    size(): Promise<number> {
      return exclusively(async () => (await read()).length);
    },
  };
}
