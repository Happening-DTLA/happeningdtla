import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";
import { prisma } from "@/lib/prisma";
import { normalizeScannedCode } from "@dtlahappening/core";
import type { ScanResult } from "@/generated/prisma/enums";

/**
 * Pairing codes get read aloud across a noisy room, so the alphabet excludes
 * anything that sounds or looks alike (0/O, 1/I/L, 5/S, 8/B). Short because a
 * human types it once; safe because it dies on first use and expires quickly.
 */
const pairingAlphabet = "234679ACDEFGHJKMNPQRTUVWXYZ";
const newPairingCode = customAlphabet(pairingAlphabet, 6);

/** The device's standing credential. Never spoken, so length costs nothing. */
const newToken = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 40);

export const PAIRING_CODE_TTL_MINUTES = 30;

/**
 * Raised when we could not determine a ticket's status — as distinct from
 * determining that it is invalid. Never render this as a rejection.
 */
export class InconclusiveScanError extends Error {
  readonly inconclusive = true;
  constructor() {
    super("Could not read the ticket");
    this.name = "InconclusiveScanError";
  }
}

/**
 * Transient database faults — a dropped pooled connection, a lost
 * serialization race, connection state corrupted under burst load. None of
 * them mean the scan was wrong; they mean the attempt never landed.
 *
 * A door is the worst place to surface these. Someone is standing in front of
 * a person holding a phone, and "try again" is not an acceptable answer when
 * retrying is something we can do ourselves in 50ms.
 */
const TRANSIENT_DB_CODES = new Set(["P1017", "P2024", "P2028", "P2034"]);

function isTransient(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  if (code && TRANSIENT_DB_CODES.has(code)) return true;
  // Postgres protocol desync under concurrency arrives as a raw SQLSTATE
  // rather than a Prisma code, in a few shapes:
  //   08P01  bind message supplies N parameters...
  //   34000  portal "" does not exist
  // Both mean the statement never ran, so retrying is safe and correct.
  const message = (err as Error)?.message ?? "";
  return /08P01|34000|ConnectionClosed|prepared statement|portal "" does not exist/i.test(message);
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err)) throw err;
      lastError = err;
      // Short backoff with jitter, so a burst of scanners doesn't retry in
      // lockstep and recreate the pile-up they are recovering from.
      await new Promise((r) => setTimeout(r, 40 * (i + 1) + Math.random() * 40));
    }
  }
  throw lastError;
}

export interface ScanOutcome {
  result: ScanResult;
  /** What the door person should read off the screen, at a glance. */
  message: string;
  ticket?: {
    code: string;
    tierName: string;
    holderName: string | null;
    checkedInAt: string;
  };
  /** For DUPLICATE: when it was first admitted, so staff can judge. */
  firstScannedAt?: string;
}

/** Creates an unclaimed session and returns the code to read out. */
export async function createDoorSession(input: {
  eventId: string;
  deviceLabel?: string;
  expiresAt: Date;
}) {
  return prisma.doorSession.create({
    data: {
      eventId: input.eventId,
      pairingCode: newPairingCode(),
      pairingCodeExpiresAt: new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60_000),
      deviceLabel: input.deviceLabel,
      expiresAt: input.expiresAt,
    },
  });
}

/**
 * Exchanges a pairing code for a device token.
 *
 * The code is consumed atomically — a conditional update on claimedAt — so two
 * phones racing on the same code cannot both end up paired.
 */
export async function claimDoorSession(pairingCode: string, deviceLabel?: string) {
  const code = pairingCode.trim().toUpperCase();
  const token = newToken();

  const claimed = await prisma.doorSession.updateMany({
    where: {
      pairingCode: code,
      claimedAt: null,
      revokedAt: null,
      pairingCodeExpiresAt: { gt: new Date() },
      expiresAt: { gt: new Date() },
    },
    data: { claimedAt: new Date(), token, ...(deviceLabel ? { deviceLabel } : {}) },
  });

  if (claimed.count === 0) return null;

  return prisma.doorSession.findUnique({
    where: { pairingCode: code },
    include: { event: { include: { venue: { select: { name: true } } } } },
  });
}

/** Resolves a device token to a live session, or null. */
export async function authenticateDoor(token: string) {
  if (!token) return null;
  const session = await withRetry(() =>
    prisma.doorSession.findUnique({
      where: { token },
      include: { event: { include: { venue: { select: { name: true } } } } },
    }),
  );
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  return session;
}

/**
 * Admit a ticket, or explain why not.
 *
 * The load-bearing line is the conditional update on `checkedInAt IS NULL`.
 * Postgres evaluates predicate and assignment in one statement under a row
 * lock, so exactly one of two simultaneous scans can win — which is what stops
 * a screenshot passed around a group chat getting four people through two
 * different doors at once. A read-then-write would let both succeed.
 *
 * Every attempt is logged, including failures and unknown codes. When someone
 * argues with the door, the log is what settles it.
 */
export async function scanTicket(input: {
  rawCode: string;
  sessionId: string;
  eventId: string;
  venueId?: string | null;
  syncedFromOffline?: boolean;
}): Promise<ScanOutcome> {
  const code = normalizeScannedCode(input.rawCode);

  const log = (result: ScanResult, ticketId?: string) =>
    withRetry(() => prisma.scan.create({
      data: {
        ticketId,
        rawCode: input.rawCode.slice(0, 200),
        result,
        doorSessionId: input.sessionId,
        venueId: input.venueId ?? undefined,
        syncedFromOffline: input.syncedFromOffline ?? false,
      },
    }));

  const ticket = await withRetry(() => prisma.ticket.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      eventId: true,
      status: true,
      holderName: true,
      checkedInAt: true,
      ticketType: { select: { name: true } },
      order: { select: { status: true } },
      event: { select: { id: true, title: true } },
    },
  }));

  if (!ticket) {
    // A null lookup is ambiguous under contention: it means "no such code",
    // but a connection fault can also surface as an empty result rather than
    // a throw. Declaring INVALID_CODE on the first null risks turning away
    // someone holding a ticket they paid for — the single worst outcome this
    // system can produce.
    //
    // So confirm before rejecting. One extra query, only on the path that is
    // about to refuse entry, which is exactly where the cost is worth paying.
    const confirm = await withRetry(() =>
      prisma.ticket.findUnique({ where: { code }, select: { id: true } }),
    );
    if (!confirm) {
      await log("INVALID_CODE");
      return { result: "INVALID_CODE", message: "Not a valid ticket" };
    }
    // It DOES exist — the first read lied. Do not return INVALID_CODE here:
    // the scanner paints that red as "NOT VALID", which would have a door
    // person turn away someone holding a real ticket. This is an inconclusive
    // read, not a verdict, so raise it as retryable and let the caller either
    // retry or fall back to the offline manifest.
    throw new InconclusiveScanError();
  }

  if (ticket.eventId !== input.eventId) {
    await log("WRONG_EVENT", ticket.id);
    return {
      result: "WRONG_EVENT",
      message: `This ticket is for ${ticket.event.title}`,
    };
  }

  // A ticket whose order was refunded or never paid must not open a door, even
  // though the row still exists.
  if (ticket.status !== "VALID" || ticket.order.status !== "PAID") {
    await log("REFUNDED_TICKET", ticket.id);
    return {
      result: "REFUNDED_TICKET",
      message: ticket.status === "REFUNDED" ? "Ticket was refunded" : "Ticket is not valid",
    };
  }

  // Query budget matters here. A door is a burst workload — a queue of people
  // scanning within seconds of each other — and every extra round trip
  // multiplies against the connection pool. An earlier version did eight
  // queries per scan and exhausted the pool at eight concurrent scans.
  const admittedAt = new Date();
  const admitted = await withRetry(() =>
    prisma.ticket.updateMany({
      where: { id: ticket.id, checkedInAt: null },
      data: { checkedInAt: admittedAt },
    }),
  );

  if (admitted.count === 0) {
    // Usually the timestamp from the read above is already correct. It is only
    // stale when another scanner won the race in between, which is rare enough
    // to be worth one extra query on that path alone.
    const firstAt =
      ticket.checkedInAt ??
      (await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { checkedInAt: true },
      }))?.checkedInAt;

    await log("DUPLICATE", ticket.id);
    return {
      result: "DUPLICATE",
      message: "Already scanned",
      firstScannedAt: firstAt?.toISOString(),
    };
  }

  // We set the timestamp, so there is nothing to read back.
  await log("ADMITTED", ticket.id);

  return {
    result: "ADMITTED",
    message: "Let them in",
    ticket: {
      code: ticket.code,
      tierName: ticket.ticketType.name,
      holderName: ticket.holderName,
      checkedInAt: admittedAt.toISOString(),
    },
  };
}

/** Live door numbers. Deliberately excludes anything about money. */
export async function doorStats(eventId: string) {
  const [sold, admitted] = await Promise.all([
    prisma.ticket.count({ where: { eventId, status: "VALID", order: { status: "PAID" } } }),
    prisma.ticket.count({
      where: { eventId, status: "VALID", order: { status: "PAID" }, checkedInAt: { not: null } },
    }),
  ]);
  return { sold, admitted, remaining: Math.max(0, sold - admitted) };
}

/**
 * SHA-256 of a normalised ticket code.
 *
 * The offline manifest ships hashes rather than codes on purpose. A door phone
 * gets lost or borrowed; if it carried the literal codes for the night, whoever
 * held it could mint working QR images for every unscanned ticket. A hash of a
 * 79-bit random code is not reversible, so the same file is useless to them
 * while still letting the device answer "is this a real ticket?" offline.
 */
export function hashTicketCode(code: string): string {
  return createHash("sha256").update(normalizeScannedCode(code)).digest("hex");
}

/**
 * Everything a device needs to run a door with no network.
 *
 * Downloaded before doors open. Includes which tickets are ALREADY checked in
 * so a device joining late doesn't wave through people who were admitted at
 * another door.
 */
export async function doorManifest(eventId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { eventId, status: "VALID", order: { status: "PAID" } },
    select: { code: true, checkedInAt: true },
  });

  return {
    eventId,
    generatedAt: new Date().toISOString(),
    valid: tickets.map((t) => hashTicketCode(t.code)),
    alreadyCheckedIn: tickets
      .filter((t) => t.checkedInAt)
      .map((t) => hashTicketCode(t.code)),
  };
}

export interface QueuedScan {
  code: string;
  /** When the door actually scanned it, not when it synced. */
  scannedAt: string;
}

/**
 * Applies scans captured while offline.
 *
 * Admission keeps the ORIGINAL door timestamp, not the sync time, so the audit
 * log reflects when someone actually walked in.
 *
 * Two devices can both admit the same ticket while neither can see the other.
 * That is unavoidable without a network, so it is resolved here rather than
 * pretended away: the first sync to land wins and the second is reported back
 * as a duplicate, giving staff an honest after-the-fact conflict list instead
 * of a silent double-entry.
 */
export async function syncOfflineScans(input: {
  sessionId: string;
  eventId: string;
  venueId?: string | null;
  scans: QueuedScan[];
}) {
  const results: { code: string; result: ScanResult }[] = [];

  for (const queued of input.scans) {
    const code = normalizeScannedCode(queued.code);
    const scannedAt = new Date(queued.scannedAt);

    const ticket = await withRetry(() =>
      prisma.ticket.findUnique({
        where: { code },
        select: { id: true, eventId: true, status: true, order: { select: { status: true } } },
      }),
    );

    let result: ScanResult;
    if (!ticket) result = "INVALID_CODE";
    else if (ticket.eventId !== input.eventId) result = "WRONG_EVENT";
    else if (ticket.status !== "VALID" || ticket.order.status !== "PAID") result = "REFUNDED_TICKET";
    else {
      const won = await withRetry(() =>
        prisma.ticket.updateMany({
          where: { id: ticket.id, checkedInAt: null },
          data: { checkedInAt: scannedAt },
        }),
      );
      result = won.count === 1 ? "ADMITTED" : "DUPLICATE";
    }

    await withRetry(() =>
      prisma.scan.create({
        data: {
          ticketId: ticket?.id,
          rawCode: queued.code.slice(0, 200),
          result,
          doorSessionId: input.sessionId,
          venueId: input.venueId ?? undefined,
          scannedAt,
          syncedFromOffline: true,
        },
      }),
    );

    results.push({ code: queued.code, result });
  }

  return results;
}
