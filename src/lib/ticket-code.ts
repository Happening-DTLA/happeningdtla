import { customAlphabet } from "nanoid";

/**
 * Ticket codes are the only thing standing between a paying customer and a
 * freeloader, so they must be unguessable — never sequential, never derived
 * from the order.
 *
 * Alphabet excludes 0/O/1/I/L to survive being read aloud at a loud door and
 * typed in manually when a phone screen is too cracked or dim to scan.
 * 16 chars from a 31-char alphabet is ~79 bits: not brute-forceable, and short
 * enough to render as a dense-but-readable QR.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const generate = customAlphabet(ALPHABET, 16);

export function newTicketCode(): string {
  return generate();
}

/** Display form: XXXX-XXXX-XXXX-XXXX, for reading out at a door. */
export function formatTicketCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

export function normalizeScannedCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
