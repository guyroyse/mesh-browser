/**
 * HTTP-like response parsing for content fetched over Reticulum.
 *
 * Ported from the former Python backend, with two deliberate changes:
 *
 *   1. No base64. The Python version base64-encoded the body only to decode it
 *      again one call later in its own HTTP handler; that round trip existed
 *      solely to cross the JSON bridge, which is gone. Resource data arrives as
 *      a Uint8Array and is handed straight to Response.
 *
 *   2. Header detection is anchored rather than searched. Python tested
 *      `b'\r\n\r\n' in content`, so a headerless binary body that happened to
 *      contain that sequence was split, and everything before it silently
 *      discarded. We require the response to actually begin with `HTTP/`.
 */

import mime from 'mime'

const HTTP_PREFIX = 'HTTP/'
const HEADER_SEPARATOR = [0x0d, 0x0a, 0x0d, 0x0a] /* \r\n\r\n */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

/*
 * Headers end within a few KB in any real response. Bounding the search stops
 * a headerless multi-megabyte body that happens to start with "HTTP/" from
 * being scanned end to end.
 */
const MAX_HEADER_BYTES = 64 * 1024

/*
 * Framing headers describe a transfer that no longer applies once the body is
 * a Uint8Array in memory. Passing them to Response would at best be ignored
 * and at worst contradict the actual body length. Content-Encoding is
 * deliberately *not* here: it describes the bytes themselves.
 */
const FRAMING_HEADERS = new Set([
  'connection',
  'content-length',
  'keep-alive',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

export interface ParsedResponse {
  body: Uint8Array<ArrayBuffer>
  /** Always carries a Content-Type, guessed from the path if the server sent none. */
  headers: Headers
  statusCode: number
}

export function parseResponse(raw: Uint8Array, path: string): ParsedResponse {
  /*
   * Resource data is always backed by a plain ArrayBuffer, but reticulum-js
   * types it as ArrayBufferLike (which admits SharedArrayBuffer). Response's
   * BodyInit rejects that, so narrow once here rather than copying the body.
   */
  const content = raw as Uint8Array<ArrayBuffer>
  const separatorIndex = startsWithHttp(content) ? indexOfSeparator(content) : -1

  /* No parseable status line - treat the whole payload as a body */
  if (separatorIndex === -1) {
    return { body: content, headers: headersFor(null, path), statusCode: 200 }
  }

  /*
   * Header bytes are ISO-8859-1, not UTF-8. Decoding them as UTF-8 turns a
   * stray high byte into U+FFFD instead of round-tripping it.
   */
  const block = new TextDecoder('latin1').decode(content.subarray(0, separatorIndex))
  const body = content.subarray(separatorIndex + HEADER_SEPARATOR.length)

  return {
    body,
    headers: headersFor(block, path),
    statusCode: extractStatusCode(block)
  }
}

function startsWithHttp(content: Uint8Array): boolean {
  if (content.length < HTTP_PREFIX.length) return false

  for (let i = 0; i < HTTP_PREFIX.length; i++) {
    if (content[i] !== HTTP_PREFIX.charCodeAt(i)) return false
  }

  return true
}

function indexOfSeparator(content: Uint8Array): number {
  const limit = Math.min(content.length, MAX_HEADER_BYTES) - HEADER_SEPARATOR.length

  for (let i = 0; i <= limit; i++) {
    if (
      content[i] === HEADER_SEPARATOR[0] &&
      content[i + 1] === HEADER_SEPARATOR[1] &&
      content[i + 2] === HEADER_SEPARATOR[2] &&
      content[i + 3] === HEADER_SEPARATOR[3]
    ) {
      return i
    }
  }

  return -1
}

/** 'HTTP/1.1 200 OK' -> 200. Defaults to 200, matching the Python behaviour. */
function extractStatusCode(block: string): number {
  const statusLine = block.split('\r\n')[0] ?? ''
  const statusCode = Number.parseInt(statusLine.split(' ')[1] ?? '', 10)

  return Number.isNaN(statusCode) ? 200 : statusCode
}

/**
 * Every header the server sent, minus framing, plus a Content-Type fallback.
 *
 * The whole set is kept rather than just the content type: caching, redirects
 * and content negotiation all need headers the parse has already decoded, and
 * re-deriving them later is impossible once the bytes are gone.
 */
function headersFor(block: string | null, path: string): Headers {
  const headers = new Headers()

  for (const line of block?.split('\r\n').slice(1) ?? []) {
    const separator = line.indexOf(':')
    if (separator === -1) continue

    const name = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()

    if (FRAMING_HEADERS.has(name.toLowerCase())) continue

    /* One malformed line must not cost us the rest of the response */
    try {
      headers.append(name, value)
    } catch {
      continue
    }
  }

  if (!headers.has('content-type')) {
    headers.set('content-type', guessContentType(path))
  }

  return headers
}

function guessContentType(path: string): string {
  /* mime handles directory segments; it does not strip a query string */
  return mime.getType(path.split('?')[0]) ?? DEFAULT_CONTENT_TYPE
}
