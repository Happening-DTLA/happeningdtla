/**
 * Ticket code helpers safe to run on a phone.
 *
 * GENERATION lives on the server only (apps/web). A client that can mint codes
 * is a client that can mint free tickets.
 */

/** Excludes 0/O/1/I/L — these get read aloud at loud doors and typed by hand. */
export const TICKET_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const TICKET_CODE_LENGTH = 16;

/** Display form XXXX-XXXX-XXXX-XXXX, for reading out at a door. */
export function formatTicketCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, "$1-");
}

/**
 * Scanners pick up whitespace, casing and dashes. Normalise before lookup so a
 * hand-typed code matches a scanned one.
 */
export function normalizeScannedCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Cheap client-side sanity check before hitting the network at a busy door. */
export function looksLikeTicketCode(input: string): boolean {
  const c = normalizeScannedCode(input);
  return (
    c.length === TICKET_CODE_LENGTH &&
    [...c].every((ch) => TICKET_CODE_ALPHABET.includes(ch))
  );
}
