/**
 * URL parsing for nomadnet:// destinations.
 *
 * Pure — no Reticulum dependency beyond hex decoding.
 */

import { parseDestHash } from '../destination-hash'

/** What a NomadNet node serves when no page is named. */
const DEFAULT_PAGE = '/page/index.mu'

export interface NomadnetTarget {
  destHash: Uint8Array
  destHashHex: string
  /** The NomadNet request path, passed to link.request() byte for byte. */
  path: string
}

/**
 * Parse a nomadnet:// URL into a destination hash and a request path.
 *
 * The URL path *is* the NomadNet request path - `/page/index.mu` stays
 * `/page/index.mu`. That identity is what makes relative links inside a page
 * resolve correctly without any rewriting on our side.
 */
export function parseNomadnetUrl(url: URL): NomadnetTarget {
  const destHashHex = url.hostname.toLowerCase()

  /*
   * nomadnet has no notion of a port - a destination hash names an endpoint
   * outright. Rejecting beats silently ignoring what the user typed.
   *
   * An *empty* port must keep passing, and the test is `url.port` rather than
   * anything stricter for that reason. NomadNet addresses destinations as
   * `<hash>:/page/foo.mu`, so a pasted or MeshChat-shaped URL arrives here as
   * `nomadnet://<hash>:/page/foo.mu`. The URL parser reads that colon as an
   * empty port and canonicalises it away, leaving exactly the URL we would
   * have written ourselves - the address bar even self-corrects on display.
   * Tightening this check would break pasting the format everyone else uses.
   */
  if (url.port) {
    throw new Error(`nomadnet:// URLs cannot carry a port, got :${url.port}`)
  }

  /*
   * The `|| DEFAULT_PAGE` is load-bearing despite the scheme being registered
   * as `standard`: that registration teaches *Chromium's* parser, while this
   * runs in the main process against Node's URL, where `nomadnet://<hash>`
   * parses with an empty pathname.
   *
   * The query string is deliberately *not* appended. NomadNet request paths
   * are opaque tokens, and a page's form fields travel as the request's msgpack
   * `data` argument rather than in the path. The fragment never leaves the
   * client.
   */
  const path = url.pathname || DEFAULT_PAGE

  return { ...parseDestHash(destHashHex), path }
}

/** True for a path NomadNet serves as a downloadable file rather than a page. */
export function isFilePath(path: string): boolean {
  return path.startsWith('/file/')
}
