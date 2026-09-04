/**
 * URL parsing for rweb:// destinations.
 *
 * Pure — no Reticulum dependency beyond hex decoding.
 */

import { parseDestHash } from '../destination-hash'

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

  return { ...parseDestHash(destHashHex), path }
}

