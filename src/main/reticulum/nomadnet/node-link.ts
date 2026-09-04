/**
 * One warm RNS Link to a NomadNet node, shared by every request to it.
 *
 * Deliberately the opposite of rserver/link-pool.ts, and that is not a
 * mistake: NomadNet rides RNS REQUEST/RESPONSE, where every request carries a
 * 16-byte request_id that the node echoes back, and reticulum-js correlates
 * replies through `link.pendingRequests`. Many requests on one link is
 * therefore *correct* - there is no response a caller could mistake for its
 * own.
 *
 * Concurrency is still bounded, but for throughput rather than correctness:
 * each Resource runs its own flow-control window over the one link's
 * bandwidth, routing an inbound Resource part is O(live resources), and a
 * request's timeout starts when it is sent rather than when it is serviced.
 * Firing everything at once makes every page element finish late instead of
 * some finishing early.
 */

import { type Link } from '@reticulum/core'
import { LinkStatus } from '@reticulum/core/src/transport/link.js'

import { config } from '../../config'
import { Semaphore } from '../async'
import type { RemoteDestination } from '../destination'

const settings = config.reticulum

export interface NodeLinkOptions {
  /** Called when the link is gone and nobody is waiting, so it can be dropped. */
  onDispose?: () => void
}

export class NodeLink {
  readonly #destination: RemoteDestination
  readonly #onDispose: () => void

  #semaphore = new Semaphore(settings.nomadnet.maxConcurrentRequests)
  #link: Promise<Link> | null = null
  #idleTimer: NodeJS.Timeout | null = null
  #inFlight = 0

  constructor(destination: RemoteDestination, { onDispose = () => {} }: NodeLinkOptions = {}) {
    this.#destination = destination
    this.#onDispose = onDispose
  }

  /**
   * Send one request and await its response.
   *
   * `#inFlight` does three jobs at once, which is why it is a bare counter and
   * not an acquire/release API: it gates the idle timer, it tells dispose
   * whether anyone is still here, and it is incremented and decremented inside
   * the try/finally so it cannot drift with caller discipline.
   */
  async request(path: string, data: unknown = null): Promise<unknown> {
    /* Before the semaphore, so requests to an unreachable node hit the cached
       path failure rather than each queueing for a permit first */
    await this.#destination.ensurePath()
    await this.#semaphore.acquire()

    this.#inFlight++
    this.#clearIdleTimer()

    try {
      const link = await this.#activeLink()

      return await link.request(path, data, {
        /* Explicit: reticulum-js defaults to (rtt * 6 + 4.5) seconds, which a
           LoRa hop or a subprocess-backed dynamic page blows straight through */
        timeout: settings.nomadnet.requestTimeout
      })
    } finally {
      this.#inFlight--

      if (this.#inFlight === 0) this.#armIdleTimer()

      this.#semaphore.release()
      this.#disposeIfEmpty()
    }
  }

  /**
   * Close the link.
   *
   * Callers still inside request() are not waited for - this runs on the
   * shutdown path, where a stuck request must not delay the quit.
   */
  async drain(): Promise<void> {
    this.#clearIdleTimer()

    const pending = this.#link
    this.#link = null

    if (!pending) return

    /* The link may still be establishing; a failed open has nothing to close */
    const link = await pending.catch(() => null)

    if (link) await this.#destination.releaseLink(link)
  }

  /**
   * The node's link, opening one if there is none or the last one died.
   *
   * Memoised, with the failure deliberately not cached - the node may simply
   * not have announced yet when the first attempt ran.
   */
  async #activeLink(): Promise<Link> {
    const existing = this.#link

    if (existing) {
      const link = await existing.catch(() => null)

      if (link && link.status === LinkStatus.ACTIVE) return link

      /* Stale or failed: drop it and open a fresh one below */
      if (this.#link === existing) this.#link = null
    }

    this.#link ??= this.#openLink().catch((error: Error) => {
      this.#link = null
      throw error
    })

    return this.#link
  }

  async #openLink(): Promise<Link> {
    const link = await this.#destination.openLink()

    /*
     * Invalidate reactively rather than polling status: a node that closes the
     * link between requests would otherwise only be noticed on the next call,
     * after the caller had already committed to it.
     */
    link.addEventListener(
      'close',
      () => {
        if (this.#link) {
          void this.#link.then(
            (current) => {
              if (current === link) this.#link = null
            },
            () => {}
          )
        }

        this.#destination.closeLink(link)
      },
      { once: true }
    )

    return link
  }

  #armIdleTimer(): void {
    this.#clearIdleTimer()

    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = null
      void this.drain().then(() => this.#disposeIfEmpty())
    }, settings.linkIdleTimeout)

    /* Nothing should stay alive merely to close an idle link */
    this.#idleTimer.unref()
  }

  #clearIdleTimer(): void {
    if (!this.#idleTimer) return

    clearTimeout(this.#idleTimer)
    this.#idleTimer = null
  }

  #disposeIfEmpty(): void {
    if (this.#inFlight > 0) return
    if (this.#link) return
    if (!this.#semaphore.idle) return

    this.#onDispose()
  }
}
