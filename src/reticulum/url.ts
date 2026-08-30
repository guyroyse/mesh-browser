/**
 * URL parsing for rweb:// destinations.
 *
 * Port of src/python/reticulum/url.py. Pure — no Reticulum dependency beyond
 * hex decoding.
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

  /*
   * rweb has no notion of a port - a destination hash names an endpoint
   * outright. Rejecting beats silently ignoring what the user typed.
   */
  if (url.port) {
    throw new Error(`rweb:// URLs cannot carry a port, got :${url.port}`)
  }

  validateDestHash(destHashHex)

  /*
   * Preserve the query string - rserver may care about it. The fragment is
   * deliberately dropped; it never leaves the client.
   *
   * The `|| '/'` is load-bearing despite the scheme being registered as
   * `standard`: that registration teaches *Chromium's* parser, while this runs
   * in the main process against Node's URL, where `rweb://<hash>` parses with
   * an empty pathname.
   */
  const path = `${url.pathname || '/'}${url.search}`

  return { destHash: fromHex(destHashHex), destHashHex, path }
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
