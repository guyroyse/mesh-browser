/**
 * The rserver wire protocol: an HTTP-like request over an RNS Link, answered
 * by a Resource carrying an HTTP-like response.
 *
 * Kept apart from the link pooling so that adding a method, a request header,
 * or redirect handling is a change to this file alone.
 */

import { ContextType, type Link, Packet, PacketType } from '@reticulum/core'

import { config } from '../config'
import { rejectAfter } from './async'
import type { RwebTarget } from './url'

/**
 * Send one request and await the response bytes.
 *
 * Listeners are registered before sending - a fast server can reply
 * immediately - and removed afterwards via AbortController, since links are
 * pooled and a stale listener would resolve somebody else's request.
 */
export async function requestResource(link: Link, target: RwebTarget): Promise<Uint8Array> {
  const cleanup = new AbortController()

  try {
    /*
     * Python RNS splits anything over ~1 MiB into multiple Resources, and
     * reticulum-js does not reassemble them (its Phase 3 scope note calls
     * multi-segment splitting unimplemented). Each segment arrives as its own
     * complete, hash-checked Resource, so we collect them here and join them
     * in order. Taking only the first is what silently truncated large images.
     */
    const segments = new Map<number, Uint8Array>()

    const replied = new Promise<Uint8Array>((resolve, reject) => {
      link.addEventListener(
        'resource',
        (event) => {
          const { resource } = (event as CustomEvent).detail

          resource.whenComplete().then(() => {
            /* Both default to 1 for an unsegmented transfer */
            const index: number = resource.segmentIndex || 1
            const total: number = resource.totalSegments || 1

            segments.set(index, resource.data)

            if (total > 1) {
              console.log(`rweb: received segment ${index}/${total} for ${target.path}`)
            }

            /* Keyed by index, so a duplicate segment cannot fake completeness */
            if (segments.size >= total) resolve(joinSegments(segments, total))
          }, reject)
        },
        { signal: cleanup.signal }
      )

      /*
       * rserver answers with Resources, but a small enough reply can arrive as
       * a plain data packet. Accepting it unconditionally is only safe because
       * the pool guarantees this link carries one request at a time - there is
       * no other request whose response this could be.
       */
      link.addEventListener(
        'data',
        (event) => resolve((event as CustomEvent).detail.packet.payload),
        { signal: cleanup.signal }
      )
    })

    await link.send(buildRequest(link, target))

    return await Promise.race([
      replied,
      rejectAfter(
        config.reticulum.responseTimeout,
        `No response received within ${config.reticulum.responseTimeout / 1000}s for ${target.path}`,
        cleanup.signal
      )
    ])
  } finally {
    cleanup.abort()
  }
}

function buildRequest(link: Link, target: RwebTarget): Packet {
  const request =
    `GET ${target.path} HTTP/1.1\r\n` +
    `Host: ${target.destHashHex}\r\n` +
    `User-Agent: MeshBrowser/1.0\r\n` +
    `Accept: text/html,*/*\r\n\r\n`

  return new Packet({
    packetType: PacketType.DATA,
    contextByte: ContextType.NONE,
    /* link.send() re-addresses to the link id anyway; supplying it keeps the
       constructor honest rather than passing a placeholder */
    destinationHash: link.linkId,
    payload: new TextEncoder().encode(request)
  })
}

/** Concatenate segments 1..total, refusing to return a body with a hole in it. */
function joinSegments(segments: Map<number, Uint8Array>, total: number): Uint8Array {
  const ordered: Uint8Array[] = []

  for (let index = 1; index <= total; index++) {
    const segment = segments.get(index)

    if (!segment) throw new Error(`Missing segment ${index} of ${total} in response`)

    ordered.push(segment)
  }

  const joined = new Uint8Array(ordered.reduce((size, segment) => size + segment.length, 0))
  let offset = 0

  for (const segment of ordered) {
    joined.set(segment, offset)
    offset += segment.length
  }

  return joined
}
