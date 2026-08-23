import { customAlphabet } from "nanoid";
import { TICKET_CODE_ALPHABET, TICKET_CODE_LENGTH } from "@dtlahappening/core";

export { formatTicketCode, normalizeScannedCode, looksLikeTicketCode } from "@dtlahappening/core";

const generate = customAlphabet(TICKET_CODE_ALPHABET, TICKET_CODE_LENGTH);

/**
 * SERVER ONLY. 16 chars from a 31-char alphabet is ~79 bits — not brute
 * forceable, short enough to render as a scannable QR. Never expose code
 * generation to a client; a client that can mint codes mints free tickets.
 */
export function newTicketCode(): string {
  return generate();
}
