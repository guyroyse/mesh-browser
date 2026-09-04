/**
 * Micron link targets -> URLs.
 *
 * The one genuinely ambiguous corner of the format, and the piece that makes
 * clicking between protocols work: a target may name a path on the current
 * node, a path on another node, an anchor in this page, or a URL in another
 * scheme entirely.
 *
 * A target we cannot resolve is rendered inert rather than as a live link.
 * Guessing produces a mesh request that cannot succeed, and the user waits out
 * a path-discovery timeout to find out.
 */

const DEST_HASH = /^[0-9a-f]{32}$/i

/* Schemes a NomadNet page may legitimately point at, and that the browser can
   actually follow. rweb is the other half of the cross-protocol story. */
const FOLLOWABLE_SCHEMES = ['rweb://', 'nomadnet://']

const DEFAULT_PAGE = '/page/index.mu'

export type ResolvedTarget = { href: string } | { unsupported: string }

/**
 * Resolve a micron link target against the node the page came from.
 *
 * `<hash>:` is matched before anything else: without that ordering a
 * destination target is indistinguishable from an `:anchor`.
 */
export function resolveTarget(target: string, currentDestHashHex: string): ResolvedTarget {
  const trimmed = target.trim()

  if (trimmed.length === 0) return { unsupported: 'empty link target' }

  /* Another node, with a path: <hash>:/page/foo.mu */
  const separator = trimmed.indexOf(':')

  if (separator !== -1) {
    const maybeHash = trimmed.slice(0, separator)

    if (DEST_HASH.test(maybeHash)) {
      const path = trimmed.slice(separator + 1) || DEFAULT_PAGE

      return { href: `nomadnet://${maybeHash.toLowerCase()}${absolute(path)}` }
    }
  }

  /* Another node, no path */
  if (DEST_HASH.test(trimmed)) {
    return { href: `nomadnet://${trimmed.toLowerCase()}${DEFAULT_PAGE}` }
  }

  /* A URL in a scheme the browser can follow - an rweb:// link inside a
     NomadNet page is half of what makes the two feel like one web */
  if (FOLLOWABLE_SCHEMES.some((scheme) => trimmed.toLowerCase().startsWith(scheme))) {
    return { href: trimmed }
  }

  /* In-page anchors, in both spellings */
  if (trimmed.startsWith('#')) return { href: trimmed }
  if (trimmed.startsWith(':')) return { href: `#${trimmed.slice(1)}` }

  /* A path on this node. Relative paths are left relative on purpose: the
     scheme is registered `standard`, so Chromium resolves them against the
     page's own URL exactly as it would on the web. */
  if (trimmed.startsWith('/')) {
    return { href: `nomadnet://${currentDestHashHex}${trimmed}` }
  }

  if (looksLikeRelativePath(trimmed)) return { href: trimmed }

  return { unsupported: `unsupported link target: ${trimmed}` }
}

/** A cross-node target's path is always rooted, however the page wrote it. */
function absolute(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * Anything with a scheme we cannot follow (lxmf@, http://, mailto:) is not a
 * relative path, whatever else it might be.
 */
function looksLikeRelativePath(target: string): boolean {
  if (target.includes('://')) return false
  if (target.includes('@')) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return false

  return true
}
