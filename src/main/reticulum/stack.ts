/**
 * The single Reticulum instance, attached to a running rnsd shared instance.
 *
 * One stack, not one per protocol: two instances would mean two connections to
 * rnsd, two routing tables, and two sets of announces - and reticulum-js keeps
 * `Destination.knownDestinations` in a static map anyway, so the second
 * instance would not even get its own identity cache.
 *
 * Protocol clients borrow the stack through `ready()`; they own their own
 * links and are stopped before it is.
 */

import type { Link, Reticulum as ReticulumType } from '@reticulum/core'
import { Reticulum } from '@reticulum/core'
import { LocalClientInterface } from '@reticulum/node'

import type { Lifecycle } from '../lifecycle'

export class ReticulumStack implements Lifecycle {
  #rns: ReticulumType | null = null
  #startPromise: Promise<void> | null = null
  #stopped = false

  /*
   * Every link opened through RemoteDestination, so that a client which failed
   * to drain cannot leave an ACTIVE link running its 1-second watchdog past
   * rns.stop() and hang the quit.
   */
  #links = new Set<Link>()

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
   * The running stack, starting it if it is not up.
   *
   * Deliberately not a getter: a launch that failed because rnsd was not yet
   * running has to recover on the next navigation rather than leaving the app
   * dead until it is restarted. Every fetch path goes through here.
   */
  async ready(): Promise<ReticulumType> {
    if (this.#stopped) throw new Error('Reticulum stack is shutting down')

    await this.start()

    if (!this.#rns) throw new Error('Reticulum stack has not been started')

    return this.#rns
  }

  /** Called by RemoteDestination for every link it opens. */
  trackLink(link: Link): void {
    this.#links.add(link)
  }

  /** Called when a link has been closed, or handed to someone else to close. */
  untrackLink(link: Link): void {
    this.#links.delete(link)
  }

  /**
   * Stop the stack.
   *
   * Clients must have been drained first - teardown() sends LINKCLOSE and
   * needs the interface still up. Anything still tracked here is a client that
   * did not drain, so it is torn down loudly rather than left to hang the quit.
   */
  async stop(): Promise<void> {
    this.#stopped = true

    const leaked = [...this.#links]
    this.#links.clear()

    if (leaked.length > 0) {
      console.warn(`Reticulum stack: tearing down ${leaked.length} link(s) a client left open`)
      await Promise.all(leaked.map((link) => link.teardown().catch(() => {})))
    }

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
      throw new Error('Reticulum stack is shutting down')
    }

    this.#rns = rns
  }
}
