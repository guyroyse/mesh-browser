/**
 * A pool of RNS Links to one rserver destination.
 *
 * The rserver protocol carries no request identifiers, so a response cannot be
 * matched to a request. Two requests must therefore never be in flight on one
 * link. This pool hands out one link per caller and bounds how many are open
 * at once: bounded parallelism for page subresources, without ambiguity.
 *
 * Path discovery, the Destination, and the links are all per-destination
 * state, so they live here together rather than in three maps keyed by hash.
 */

import { Destination, DestType, type Link, type Reticulum } from '@reticulum/core'
import { LinkStatus } from '@reticulum/core/src/transport/link.js'

import { config } from '../config'
import { rejectAfter, Semaphore, withDeadline } from './async'
import { bz2 } from './bz2'

/* rserver listens on the "rserver.web" aspect - protocol identity, not a setting */
const APP_NAME = 'rserver.web'

const settings = config.reticulum

export interface DestinationPoolOptions {
  /** Called when the pool has no links and no callers left, so it can be dropped. */
  onDispose?: () => void
}

export class DestinationPool {
  readonly #rns: Reticulum
  readonly #destHash: Uint8Array
  readonly #destHashHex: string
  readonly #onDispose: () => void

  #semaphore = new Semaphore(settings.maxLinksPerDestination)
  #idle: Link[] = []
  #live = new Set<Link>()
  #idleTimers = new Map<Link, NodeJS.Timeout>()

  #destination: Promise<Destination> | null = null
  #pathPromise: Promise<void> | null = null
  #pathFailure: { error: Error; until: number } | null = null
  #inFlight = 0

  constructor(
    rns: Reticulum,
    destHash: Uint8Array,
    destHashHex: string,
    { onDispose = () => {} }: DestinationPoolOptions = {}
  ) {
    this.#rns = rns
    this.#destHash = destHash
    this.#destHashHex = destHashHex
    this.#onDispose = onDispose
  }

  /**
   * Borrow a link for the duration of `use`, then return it to the pool.
   *
   * Callers cannot hold a link past the callback, which is what keeps the
   * one-request-per-link invariant from depending on caller discipline.
   */
  async withLink<T>(use: (link: Link) => Promise<T>): Promise<T> {
    this.#inFlight++

    try {
      await this.#ensurePath()
      await this.#semaphore.acquire()

      let link: Link | null = null

      try {
        link = await this.#openOrReuse()

        const result = await use(link)

        this.#release(link)
        link = null

        return result
      } catch (error) {
        if (link) this.#forget(link)
        throw error
      } finally {
        this.#semaphore.release()
      }
    } finally {
      this.#inFlight--
      this.#disposeIfEmpty()
    }
  }

  /**
   * Close every link in the pool.
   *
   * Callers still inside withLink are not waited for - this runs on the
   * shutdown path, where a stuck request must not delay the quit.
   */
  async drain(): Promise<void> {
    for (const timer of this.#idleTimers.values()) clearTimeout(timer)

    this.#idleTimers.clear()
    this.#idle.length = 0

    const links = [...this.#live]
    this.#live.clear()

    await Promise.all(links.map((link) => link.teardown().catch(() => {})))
  }

  /**
   * Ensure a path to the destination is known.
   *
   * Every app launch is cold: the routing table is private to this process and
   * is not shared by rnsd, so requestPath is mandatory before the first fetch
   * no matter how long the daemon has been up. Deduplicated so a page with
   * twenty subresources broadcasts one path request, not twenty.
   */
  async #ensurePath(): Promise<void> {
    if (this.#rns.transport.hasPath(this.#destHash)) return

    if (this.#pathFailure && Date.now() < this.#pathFailure.until) {
      throw this.#pathFailure.error
    }

    this.#pathPromise ??= this.#discoverPath()
      .catch((error: Error) => {
        this.#pathFailure = { error, until: Date.now() + settings.pathFailureTtl }
        throw error
      })
      .finally(() => {
        this.#pathPromise = null
      })

    await this.#pathPromise
  }

  /**
   * Broadcast a path request and wait for the announce that answers it.
   *
   * Transport writes the routing-table entry immediately before dispatching
   * `announce`, so by the time the event fires hasPath() is already true.
   */
  async #discoverPath(): Promise<void> {
    const { transport } = this.#rns
    const cleanup = new AbortController()

    try {
      /* Registered before requestPath so a fast answer cannot be missed */
      const announced = new Promise<void>((resolve) => {
        transport.addEventListener(
          'announce',
          (event) => {
            const { destinationHash } = (event as CustomEvent).detail
            if (sameHash(destinationHash, this.#destHash)) resolve()
          },
          { signal: cleanup.signal }
        )
      })

      await transport.requestPath(this.#destHash)

      /* An announce can land between the caller's hasPath() check and the
         listener above, so re-check before committing to the wait */
      if (transport.hasPath(this.#destHash)) return

      await Promise.race([
        announced,
        rejectAfter(
          settings.pathDiscoveryTimeout,
          `Could not find path to destination ${this.#destHashHex} ` +
            `within ${settings.pathDiscoveryTimeout / 1000}s`,
          cleanup.signal
        )
      ])
    } finally {
      cleanup.abort()
    }
  }

  async #openOrReuse(): Promise<Link> {
    while (this.#idle.length > 0) {
      const link = this.#idle.pop()!

      this.#clearIdleTimer(link)

      if (link.status === LinkStatus.ACTIVE) return link

      /* Stale links still run a watchdog - close, don't just drop */
      this.#forget(link)
    }

    return this.#open()
  }

  async #open(): Promise<Link> {
    const destination = await this.#resolveDestination()
    const link = await withDeadline(
      destination.createLink(),
      settings.linkEstablishmentTimeout,
      `Link establishment timeout after ${settings.linkEstablishmentTimeout / 1000}s`
    )

    configureLink(link)
    this.#live.add(link)

    return link
  }

  /** Built once per destination rather than once per link. */
  #resolveDestination(): Promise<Destination> {
    this.#destination ??= this.#buildDestination().catch((error: Error) => {
      /* A failure must not be cached - the announce may simply not have
         arrived yet */
      this.#destination = null
      throw error
    })

    return this.#destination
  }

  async #buildDestination(): Promise<Destination> {
    const identity = await Destination.recall(this.#destHash)

    if (!identity) {
      throw new Error(`Could not recall server identity for ${this.#destHashHex}`)
    }

    return Destination.OUT(APP_NAME, DestType.SINGLE, identity, this.#rns)
  }

  #release(link: Link): void {
    if (link.status !== LinkStatus.ACTIVE) {
      this.#forget(link)
      return
    }

    this.#idle.push(link)

    const timer = setTimeout(() => {
      this.#forget(link)
      this.#disposeIfEmpty()
    }, settings.linkIdleTimeout)

    /* Nothing should stay alive merely to close an idle link */
    timer.unref()
    this.#idleTimers.set(link, timer)
  }

  /**
   * Drop a link from every index and close it.
   *
   * The single place that has to keep idle/live/timers consistent - reuse of a
   * stale link, an error mid-request, and idle expiry all land here.
   */
  #forget(link: Link): void {
    this.#clearIdleTimer(link)

    const index = this.#idle.indexOf(link)
    if (index !== -1) this.#idle.splice(index, 1)

    this.#live.delete(link)

    closeQuietly(link)
  }

  #clearIdleTimer(link: Link): void {
    const timer = this.#idleTimers.get(link)

    if (timer) {
      clearTimeout(timer)
      this.#idleTimers.delete(link)
    }
  }

  #disposeIfEmpty(): void {
    if (this.#inFlight > 0) return
    if (this.#live.size > 0) return
    if (!this.#semaphore.idle) return

    this.#onDispose()
  }
}

/**
 * Apply the per-link settings every rserver link needs.
 *
 * `bz2` must be set before any resource advertisement arrives: Python RNS
 * bz2-compresses Resources and reticulum-js ships no codec, so without it
 * every fetch fails in Resource.assemble. This is invisible in JS-to-JS
 * testing - only a real Python peer exercises it.
 */
function configureLink(link: Link): void {
  link.bz2 = bz2
  link.maxResourceSize = settings.maxResourceSize
}

/** Teardown is best-effort: a link we are done with may already be gone. */
function closeQuietly(link: Link): void {
  void link.teardown().catch(() => {})
}

function sameHash(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }

  return true
}
