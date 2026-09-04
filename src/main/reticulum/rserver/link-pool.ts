/**
 * A pool of RNS Links to one rserver destination.
 *
 * **Critical**: the rserver protocol carries no request identifiers, so a
 * response cannot be matched to a request. Two requests must therefore never
 * be in flight on one link. This pool hands out one link per caller and bounds
 * how many are open at once: bounded parallelism for page subresources,
 * without ambiguity.
 *
 * This is an rserver constraint, not a Reticulum one - see nomadnet/node-link.ts,
 * which shares one link between many requests because RNS REQUEST/RESPONSE
 * carries a request id. The two are deliberately separate classes rather than
 * one parameterised by requests-per-link: here, exceeding one is a correctness
 * failure that renders another page's bytes, and that must not be reachable by
 * editing a number in config.ts.
 */

import { type Link } from '@reticulum/core'
import { LinkStatus } from '@reticulum/core/src/transport/link.js'

import { config } from '../../config'
import { Semaphore } from '../async'
import type { RemoteDestination } from '../destination'

/* rserver listens on the "rserver.web" aspect - protocol identity, not a setting */
export const RSERVER_APP_NAME = 'rserver.web'

const settings = config.reticulum

export interface LinkPoolOptions {
  /** Called when the pool has no links and no callers left, so it can be dropped. */
  onDispose?: () => void
}

export class LinkPool {
  readonly #destination: RemoteDestination
  readonly #onDispose: () => void

  #semaphore = new Semaphore(settings.rserver.maxLinksPerDestination)
  #idle: Link[] = []
  #live = new Set<Link>()
  #idleTimers = new Map<Link, NodeJS.Timeout>()
  #inFlight = 0

  constructor(destination: RemoteDestination, { onDispose = () => {} }: LinkPoolOptions = {}) {
    this.#destination = destination
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
      /* Before the semaphore, so subresources of an unreachable host hit the
         cached path failure rather than each queueing for a permit first */
      await this.#destination.ensurePath()
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

    await Promise.all(links.map((link) => this.#destination.releaseLink(link)))
  }

  async #openOrReuse(): Promise<Link> {
    while (this.#idle.length > 0) {
      const link = this.#idle.pop()!

      this.#clearIdleTimer(link)

      if (link.status === LinkStatus.ACTIVE) return link

      /* Stale links still run a watchdog - close, don't just drop */
      this.#forget(link)
    }

    const link = await this.#destination.openLink()
    this.#live.add(link)

    return link
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

    this.#destination.closeLink(link)
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
