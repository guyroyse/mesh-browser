/**
 * URL parsing for rweb:// destinations.
 *
 * Port of src/python/reticulum/url.py. Pure — no Reticulum dependency.
 */

import { fromHex } from '@reticulum/core'

/* RNS destination hashes are exactly 16 bytes / 32 hex characters */
const DEST_HASH_CHARS = 32
const DEST_HASH_PATTERN = /^[0-9a-f]{32}$/

export interface RwebTarget {
  destHash: Uint8Array
  destHashHex: string
  path: string
}

/**
 * Parse an rweb:// URL into a destination hash and a request path.
 *
 * The scheme is registered as `standard`, so Electron has already decomposed
 * the URL into a host and a path for us.
 */
export function parseRwebUrl(url: URL): RwebTarget {
  const destHashHex = url.hostname.toLowerCase()

  validateDestHash(destHashHex)

  /* Preserve the query string - rserver may care about it */
  const path = `${url.pathname || '/'}${url.search}`

  return { destHash: fromHex(destHashHex), destHashHex, path }
}

function validateDestHash(destHashHex: string): void {
  if (!destHashHex) {
    throw new Error('Destination hash cannot be empty')
  }

  if (destHashHex.length !== DEST_HASH_CHARS) {
    throw new Error(
      `Destination hash must be ${DEST_HASH_CHARS} hex characters, got ${destHashHex.length}`
    )
  }

  if (!DEST_HASH_PATTERN.test(destHashHex)) {
    throw new Error(`Invalid destination hash format: ${destHashHex}`)
  }
}
