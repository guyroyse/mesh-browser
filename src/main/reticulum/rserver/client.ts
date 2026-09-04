/**
 * Fetches rweb:// content over RNS Links.
 *
 * Owns the link pools, not the stack - see reticulum/stack.ts. Link pooling
 * lives in link-pool.ts; the request format lives in rserver.ts.
 */

import type { Lifecycle } from '../../lifecycle'
import { RemoteDestination } from '../destination'
import type { ReticulumStack } from '../stack'
import { LinkPool, RSERVER_APP_NAME } from './link-pool'
import { parseResponse, type ParsedResponse } from './response'
import { requestResource } from './rserver'
import type { RwebTarget } from './url'

export class RserverClient implements Lifecycle {
  readonly #stack: ReticulumStack
  #stopped = false
  #pools = new Map<string, LinkPool>()

  constructor(stack: ReticulumStack) {
    this.#stack = stack
  }

  /** Warming the shared stack is all there is to start for this client. */
  async start(): Promise<void> {
    this.#stopped = false
    await this.#stack.start()
  }

  /**
   * Fetch content for an rweb:// target.
   *
   * The stack starts itself on first use, so a first attempt that failed
   * because rnsd was not running recovers on the next navigation rather than
   * leaving the app dead until it is restarted.
   */
  async fetch(target: RwebTarget): Promise<ParsedResponse> {
    if (this.#stopped) throw new Error('rserver client is shutting down')

    const pool = this.#poolFor(target)
    const content = await pool.withLink((link) => requestResource(link, target))

    return parseResponse(content, target.path)
  }

  /**
   * Tear down every link.
   *
   * The stack is stopped separately and *after* this - teardown() sends
   * LINKCLOSE and needs the interface still up.
   */
  async stop(): Promise<void> {
    this.#stopped = true

    const pools = [...this.#pools.values()]
    this.#pools.clear()

    await Promise.all(pools.map((pool) => pool.drain()))
  }

  #poolFor(target: RwebTarget): LinkPool {
    let pool = this.#pools.get(target.destHashHex)

    if (!pool) {
      const destination = new RemoteDestination(
        this.#stack,
        target.destHash,
        target.destHashHex,
        RSERVER_APP_NAME
      )

      pool = new LinkPool(destination, {
        /* Drop the entry once the pool goes quiet, so browsing many hosts does
           not accumulate a map entry per destination for the whole session */
        onDispose: () => {
          if (this.#pools.get(target.destHashHex) === pool) {
            this.#pools.delete(target.destHashHex)
          }
        }
      })

      this.#pools.set(target.destHashHex, pool)
    }

    return pool
  }
}
