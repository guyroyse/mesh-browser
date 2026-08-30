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

const HTTP_PREFIX = 'HTTP/'
const HEADER_SEPARATOR = [0x0d, 0x0a, 0x0d, 0x0a] /* \r\n\r\n */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream'

/* Node has no `mimetypes`; this covers what a mesh site actually serves */
const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  mjs: 'text/javascript',
  json: 'application/json',
  xml: 'application/xml',
  txt: 'text/plain',
  md: 'text/markdown',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  pdf: 'application/pdf',
  wasm: 'application/wasm'
}

export interface ParsedResponse {
  body: Uint8Array<ArrayBuffer>
  contentType: string
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
    return { body: content, contentType: guessContentType(path), statusCode: 200 }
  }

  const headers = new TextDecoder('utf-8').decode(content.subarray(0, separatorIndex))
  const body = content.subarray(separatorIndex + HEADER_SEPARATOR.length)

  return {
    body,
    contentType: extractContentType(headers) ?? guessContentType(path),
    statusCode: extractStatusCode(headers)
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
  const limit = content.length - HEADER_SEPARATOR.length

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
function extractStatusCode(headers: string): number {
  const statusLine = headers.split('\r\n')[0] ?? ''
  const statusCode = Number.parseInt(statusLine.split(' ')[1] ?? '', 10)

  return Number.isNaN(statusCode) ? 200 : statusCode
}

function extractContentType(headers: string): string | null {
  for (const line of headers.split('\r\n')) {
    if (line.toLowerCase().startsWith('content-type:')) {
      return line.slice(line.indexOf(':') + 1).trim()
    }
  }

  return null
}

function guessContentType(path: string): string {
  const filename = path.split('?')[0].split('/').pop() ?? ''
  const extension = filename.includes('.') ? filename.split('.').pop()! : ''

  return CONTENT_TYPES[extension.toLowerCase()] ?? DEFAULT_CONTENT_TYPE
}
