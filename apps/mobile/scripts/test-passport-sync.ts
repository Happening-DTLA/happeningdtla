import assert from "node:assert/strict";
import type { Stamp } from "@dtlahappening/core";
import {
  createPassportSyncQueue,
  type PassportQueueStorage,
} from "../src/passport-sync-queue";

class MemoryStorage implements PassportQueueStorage {
  private values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const stamp = (venueId: string): Stamp => ({
  venueId,
  nightId: "night-october",
  at: "2026-10-01T19:00:00.000-07:00",
  verified: true,
});

async function persistsAcrossRestart() {
  const storage = new MemoryStorage();
  const offline = createPassportSyncQueue({
    storage,
    send: async () => {
      throw new Error("offline");
    },
  });

  await offline.enqueue(stamp("venue-one"));
  assert.deepEqual(await offline.drain(), { sent: 0, remaining: 1 });

  const delivered: string[] = [];
  const restarted = createPassportSyncQueue({
    storage,
    send: async (queued) => {
      delivered.push(queued.venueId);
    },
  });

  assert.deepEqual(await restarted.drain(), { sent: 1, remaining: 0 });
  assert.deepEqual(delivered, ["venue-one"]);
  assert.equal(await restarted.size(), 0);
}

async function deduplicatesConcurrentEnqueues() {
  const storage = new MemoryStorage();
  const queue = createPassportSyncQueue({ storage, send: async () => {} });
  const same = stamp("venue-two");

  await Promise.all([queue.enqueue(same), queue.enqueue(same), queue.enqueue(same)]);
  assert.equal(await queue.size(), 1);
}

async function retriesLostResponsesIdempotently() {
  const storage = new MemoryStorage();
  const serverRows = new Set<string>();
  let attempts = 0;

  const send = async (queued: Stamp) => {
    attempts += 1;
    serverRows.add(`${queued.nightId}:${queued.venueId}`);
    if (attempts === 1) throw new Error("response was lost after commit");
  };

  const queue = createPassportSyncQueue({ storage, send });
  await queue.enqueue(stamp("venue-three"));
  assert.deepEqual(await queue.drain(), { sent: 0, remaining: 1 });
  assert.deepEqual(await queue.drain(), { sent: 1, remaining: 0 });
  assert.equal(attempts, 2, "the client must retry a lost response");
  assert.equal(serverRows.size, 1, "duplicate delivery must create one logical check-in");
}

async function preservesAnEnqueueWaitingBehindADrain() {
  const storage = new MemoryStorage();
  let releaseSend: (() => void) | undefined;
  const sendBlocked = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });
  const delivered: string[] = [];
  const queue = createPassportSyncQueue({
    storage,
    send: async (queued) => {
      delivered.push(queued.venueId);
      await sendBlocked;
    },
  });

  await queue.enqueue(stamp("venue-four"));
  const draining = queue.drain();
  const enqueuing = queue.enqueue(stamp("venue-five"));
  releaseSend!();
  await draining;
  await enqueuing;

  assert.deepEqual(delivered, ["venue-four"]);
  assert.equal(await queue.size(), 1, "a concurrent enqueue must survive the older drain");
}

async function main() {
  await persistsAcrossRestart();
  await deduplicatesConcurrentEnqueues();
  await retriesLostResponsesIdempotently();
  await preservesAnEnqueueWaitingBehindADrain();

  console.log("passport sync queue: durable, serialized and idempotent");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
