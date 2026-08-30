/**
 * Reticulum client - replaces the Python RNS backend this app used to spawn.
 *
 * Owns a single long-lived Reticulum instance attached to a running rnsd
 * shared instance, and fetches rweb:// content over RNS Links. Link pooling
 * lives in DestinationPool; the request format lives in rserver.ts.
 */

import { Reticulum } from '@reticulum/core'
import { LocalClientInterface } from '@reticulum/node'

import { DestinationPool } from './destination-pool'
import { parseResponse, type ParsedResponse } from './response'
import { requestResource } from './rserver'
import type { RwebTarget } from './url'

export class ReticulumClient {
  #rns: Reticulum | null = null
  #startPromise: Promise<void> | null = null
  #stopped = false
  #pools = new Map<string, DestinationPool>()

  /**
   * Attach to a running rnsd shared instance.
   *
   * Safe to call repeatedly: already-started is a no-op, concurrent calls
   * share one attempt, and a previous failure does not poison later ones - the
   * user may well have started rnsd in the meantime.
   */
  async start(): Promise<void> {
    if (this.#rns) return

    this.#stopped = false
    this.#startPromise ??= this.#connect().finally(() => {
      this.#startPromise = null
    })

    await this.#startPromise
  }

  /**
   * Fetch content for an rweb:// target.
   *
   * Starts the stack if it is not up. A first attempt that failed because rnsd
   * was not running therefore recovers on the next navigation, rather than
   * leaving the app dead until it is restarted.
   */
  async fetch(target: RwebTarget): Promise<ParsedResponse> {
    if (this.#stopped) throw new Error('Reticulum client is shutting down')

    await this.start()

    const pool = this.#poolFor(target)
    const content = await pool.withLink((link) => requestResource(link, target))

    return parseResponse(content, target.path)
  }

  /**
   * Tear down every link, then stop the stack.
   *
   * Order matters: teardown() sends LINKCLOSE and needs the interface still
   * up. An ACTIVE link also runs a 1-second watchdog that rns.stop() does not
   * cancel, which would otherwise keep Electron alive after the window closes.
   */
  async stop(): Promise<void> {
    this.#stopped = true

    const pools = [...this.#pools.values()]
    this.#pools.clear()

    await Promise.all(pools.map((pool) => pool.drain()))

    await this.#rns?.stop()
    this.#rns = null
  }

  async #connect(): Promise<void> {
    const rns = new Reticulum({ logLevel: 'warning' })
    const sharedInstance = await LocalClientInterface.connectToSharedInstance()

    if (!sharedInstance) {
      throw new Error(
        'Could not reach a Reticulum shared instance. Is rnsd running, ' +
          "with 'share_instance = Yes' in ~/.reticulum/config?"
      )
    }

    rns.addInterface(sharedInstance, true)

    /*
     * A quit can land while this attempt is in flight - a fetch begun just
     * before the window closed will have started one. Installing the stack now
     * would leave it running after stop() had already finished.
     */
    if (this.#stopped) {
      await rns.stop()
      throw new Error('Reticulum client is shutting down')
    }

    this.#rns = rns
  }

  #poolFor(target: RwebTarget): DestinationPool {
    const rns = this.#rns

    if (!rns) throw new Error('Reticulum client has not been started')

    let pool = this.#pools.get(target.destHashHex)

    if (!pool) {
      pool = new DestinationPool(rns, target.destHash, target.destHashHex, {
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
