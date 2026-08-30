/**
 * Reticulum client - replaces the Python RNS backend this app used to spawn.
 *
 * Owns a single long-lived Reticulum instance attached to a running rnsd
 * shared instance, and fetches rweb:// content over RNS Links.
 */

import { ContextType, Destination, DestType, Packet, PacketType, Reticulum } from '@reticulum/core'
import type { Link } from '@reticulum/core'
import { LinkStatus } from '@reticulum/core/src/transport/link.js'
import { LocalClientInterface } from '@reticulum/node'

import { bz2 } from './bz2'
import { parseResponse, type ParsedResponse } from './response'
import type { RwebTarget } from './url'

/* rserver listens on the "rserver.web" aspect */
const APP_NAME = 'rserver.web'

/*
 * Timeouts match the Python implementation. A LoRa path can genuinely take
 * minutes, so these stay generous - the spike's 30s is too tight.
 */
const PATH_DISCOVERY_TIMEOUT = 120_000
const LINK_ESTABLISHMENT_TIMEOUT = 120_000
const RESPONSE_TIMEOUT = 300_000
const PATH_POLL_INTERVAL = 100

/*
 * The rserver protocol carries no request identifiers, so a response cannot be
 * matched to a request. Two requests must therefore never be in flight on one
 * link. We open a small pool of links per destination instead: bounded
 * parallelism for page subresources, without ambiguity.
 */
const MAX_LINKS_PER_DESTINATION = 4
const LINK_IDLE_TIMEOUT = 60_000

/*
 * reticulum-js rejects Resource advertisements over 32 MB as a bomb defense.
 * Python's ACCEPT_ALL has no cap, so leaving the default would silently break
 * large downloads that work today.
 */
const MAX_RESOURCE_SIZE = 256 * 1024 * 1024

interface DestinationPool {
  semaphore: Semaphore
  idle: Link[]
  live: Set<Link>
  idleTimers: Map<Link, NodeJS.Timeout>
  pathPromise: Promise<void> | null
}

export class ReticulumClient {
  #rns: Reticulum | null = null
  #startError: Error | null = null
  #pools = new Map<string, DestinationPool>()

  /** Attach to a running rnsd shared instance. */
  async start(): Promise<void> {
    if (this.#rns) return

    this.#startError = null

    try {
      const rns = new Reticulum({ logLevel: 'warning' })
      const sharedInstance = await LocalClientInterface.connectToSharedInstance()

      if (!sharedInstance) {
        throw new Error(
          'Could not reach a Reticulum shared instance. Is rnsd running, ' +
            "with 'share_instance = Yes' in ~/.reticulum/config?"
        )
      }

      rns.addInterface(sharedInstance, true)
      this.#rns = rns
    } catch (error) {
      /* Remembered so the error page can say why, rather than "not started" */
      this.#startError = error as Error
      throw error
    }
  }

  /** Fetch content for an rweb:// target. */
  async fetch(target: RwebTarget): Promise<ParsedResponse> {
    const rns = this.#requireStarted()
    const pool = this.#poolFor(target.destHashHex)

    await this.#ensurePath(rns, pool, target)
    await pool.semaphore.acquire()

    let link: Link | null = null

    try {
      link = await this.#acquireLink(rns, pool, target)
      const content = await this.#request(link, target)

      this.#releaseLink(pool, link)
      link = null

      return parseResponse(content, target.path)
    } catch (error) {
      if (link) await this.#discardLink(pool, link)
      throw error
    } finally {
      pool.semaphore.release()
    }
  }

  /**
   * Tear down every link, then stop the stack.
   *
   * Order matters: teardown() sends LINKCLOSE and needs the interface still
   * up. An ACTIVE link also runs a 1-second watchdog that rns.stop() does not
   * cancel, which would otherwise keep Electron alive after the window closes.
   */
  async stop(): Promise<void> {
    const teardowns: Promise<void>[] = []

    for (const pool of this.#pools.values()) {
      for (const timer of pool.idleTimers.values()) clearTimeout(timer)
      for (const link of pool.live) teardowns.push(link.teardown().catch(() => {}))
    }

    await Promise.all(teardowns)
    this.#pools.clear()

    await this.#rns?.stop()
    this.#rns = null
  }

  #requireStarted(): Reticulum {
    if (this.#startError) throw this.#startError
    if (!this.#rns) throw new Error('Reticulum client has not been started')
    return this.#rns
  }

  #poolFor(destHashHex: string): DestinationPool {
    let pool = this.#pools.get(destHashHex)

    if (!pool) {
      pool = {
        semaphore: new Semaphore(MAX_LINKS_PER_DESTINATION),
        idle: [],
        live: new Set(),
        idleTimers: new Map(),
        pathPromise: null
      }
      this.#pools.set(destHashHex, pool)
    }

    return pool
  }

  /**
   * Ensure a path to the destination is known.
   *
   * Every app launch is cold: the routing table is private to this process and
   * is not shared by rnsd, so requestPath is mandatory before the first fetch
   * no matter how long the daemon has been up. Deduplicated per destination so
   * a page with twenty subresources broadcasts one path request, not twenty.
   */
  async #ensurePath(rns: Reticulum, pool: DestinationPool, target: RwebTarget): Promise<void> {
    if (rns.transport.hasPath(target.destHash)) return

    if (!pool.pathPromise) {
      pool.pathPromise = this.#discoverPath(rns, target).finally(() => {
        pool.pathPromise = null
      })
    }

    await pool.pathPromise
  }

  async #discoverPath(rns: Reticulum, target: RwebTarget): Promise<void> {
    await rns.transport.requestPath(target.destHash)

    const deadline = Date.now() + PATH_DISCOVERY_TIMEOUT

    while (Date.now() < deadline) {
      await delay(PATH_POLL_INTERVAL)
      if (rns.transport.hasPath(target.destHash)) return
    }

    throw new Error(
      `Could not find path to destination ${target.destHashHex} ` +
        `within ${PATH_DISCOVERY_TIMEOUT / 1000}s`
    )
  }

  async #acquireLink(
    rns: Reticulum,
    pool: DestinationPool,
    target: RwebTarget
  ): Promise<Link> {
    /* Reuse a healthy idle link if there is one */
    while (pool.idle.length > 0) {
      const link = pool.idle.pop()!
      this.#clearIdleTimer(pool, link)

      if (link.status === LinkStatus.ACTIVE) return link

      /* Stale links still run a watchdog - close, don't just forget */
      pool.live.delete(link)
      void link.teardown().catch(() => {})
    }

    return this.#openLink(rns, pool, target)
  }

  async #openLink(
    rns: Reticulum,
    pool: DestinationPool,
    target: RwebTarget
  ): Promise<Link> {
    const identity = await Destination.recall(target.destHash)

    if (!identity) {
      throw new Error(`Could not recall server identity for ${target.destHashHex}`)
    }

    const destination = await Destination.OUT(APP_NAME, DestType.SINGLE, identity, rns)
    const link = await withTimeout(
      destination.createLink(),
      LINK_ESTABLISHMENT_TIMEOUT,
      `Link establishment timeout after ${LINK_ESTABLISHMENT_TIMEOUT / 1000}s`
    )

    /*
     * Must be set before any resource advertisement arrives. Python RNS
     * bz2-compresses Resources and reticulum-js ships no codec, so without
     * this every fetch fails in Resource.assemble.
     */
    link.bz2 = bz2
    link.maxResourceSize = MAX_RESOURCE_SIZE

    pool.live.add(link)

    return link
  }

  #releaseLink(pool: DestinationPool, link: Link): void {
    if (link.status !== LinkStatus.ACTIVE) {
      pool.live.delete(link)
      void link.teardown().catch(() => {})
      return
    }

    pool.idle.push(link)
    pool.idleTimers.set(
      link,
      setTimeout(() => {
        pool.idleTimers.delete(link)
        pool.idle = pool.idle.filter((idle) => idle !== link)
        pool.live.delete(link)
        void link.teardown().catch(() => {})
      }, LINK_IDLE_TIMEOUT)
    )
  }

  async #discardLink(pool: DestinationPool, link: Link): Promise<void> {
    this.#clearIdleTimer(pool, link)
    pool.idle = pool.idle.filter((idle) => idle !== link)
    pool.live.delete(link)

    await link.teardown().catch(() => {})
  }

  #clearIdleTimer(pool: DestinationPool, link: Link): void {
    const timer = pool.idleTimers.get(link)

    if (timer) {
      clearTimeout(timer)
      pool.idleTimers.delete(link)
    }
  }

  /**
   * Send one HTTP-like request and await the response.
   *
   * Listeners are registered before sending - a fast server can reply
   * immediately - and removed afterwards via AbortController, since links are
   * pooled and a stale listener would resolve somebody else's request.
   */
  async #request(link: Link, target: RwebTarget): Promise<Uint8Array> {
    const listeners = new AbortController()
    let timer: NodeJS.Timeout | undefined

    try {
      const response = new Promise<Uint8Array>((resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `No response received within ${RESPONSE_TIMEOUT / 1000}s for ${target.path}`
              )
            ),
          RESPONSE_TIMEOUT
        )

        link.addEventListener(
          'resource',
          (event) => {
            const { resource } = (event as CustomEvent).detail
            resource.whenComplete().then(() => resolve(resource.data), reject)
          },
          { signal: listeners.signal }
        )

        /* rserver always replies with Resources, but this is cheap insurance */
        link.addEventListener(
          'data',
          (event) => resolve((event as CustomEvent).detail.packet.payload),
          { signal: listeners.signal }
        )
      })

      await link.send(buildRequest(link, target))

      return await response
    } finally {
      clearTimeout(timer)
      listeners.abort()
    }
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

/** Bounds how many links we open per destination at once. */
class Semaphore {
  #permits: number
  #waiters: Array<() => void> = []

  constructor(permits: number) {
    this.#permits = permits
  }

  async acquire(): Promise<void> {
    if (this.#permits > 0) {
      this.#permits--
      return
    }

    await new Promise<void>((resolve) => this.#waiters.push(resolve))
  }

  release(): void {
    const waiter = this.#waiters.shift()

    /* Hand the permit straight to the next waiter rather than round-tripping */
    if (waiter) {
      waiter()
      return
    }

    this.#permits++
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}
