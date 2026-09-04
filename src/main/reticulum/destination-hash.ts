/**
 * Destination hash parsing, shared by every protocol that names an endpoint
 * by hash.
 *
 * Pure - no Reticulum dependency beyond hex decoding. Lives here rather than
 * beside one protocol's URL parser because both parsers need the same rules
 * and, more to the point, the same error messages.
 */

import { fromHex } from '@reticulum/core'

/* RNS destination hashes are exactly 16 bytes / 32 hex characters */
const DEST_HASH_CHARS = 32
const DEST_HASH_PATTERN = /^[0-9a-f]{32}$/

export interface DestinationHash {
  destHash: Uint8Array
  destHashHex: string
}

/** Validate a lowercase hex destination hash and decode it. */
export function parseDestHash(destHashHex: string): DestinationHash {
  validateDestHash(destHashHex)

  return { destHash: fromHex(destHashHex), destHashHex }
}

function validateDestHash(destHashHex: string): void {
  if (DEST_HASH_PATTERN.test(destHashHex)) return

  /* Length is the mistake worth naming precisely - a truncated paste is the
     common case, and "got 31" is more use than "invalid format" */
  if (destHashHex.length !== DEST_HASH_CHARS) {
    throw new Error(
      `Destination hash must be ${DEST_HASH_CHARS} hex characters, got ${destHashHex.length}`
    )
  }

  throw new Error(`Invalid destination hash format: ${destHashHex}`)
}
