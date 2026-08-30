/**
 * The rserver wire protocol: an HTTP-like request over an RNS Link, answered
 * by a Resource carrying an HTTP-like response.
 *
 * Kept apart from the link pooling so that adding a method, a request header,
 * or redirect handling is a change to this file alone.
 */

import { ContextType, type Link, Packet, PacketType } from '@reticulum/core'

import { rejectAfter } from './async'
import type { RwebTarget } from './url'

const RESPONSE_TIMEOUT = 300_000

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
    const replied = new Promise<Uint8Array>((resolve, reject) => {
      link.addEventListener(
        'resource',
        (event) => {
          const { resource } = (event as CustomEvent).detail
          resource.whenComplete().then(() => resolve(resource.data), reject)
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
        RESPONSE_TIMEOUT,
        `No response received within ${RESPONSE_TIMEOUT / 1000}s for ${target.path}`,
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
