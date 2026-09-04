/**
 * A remote Reticulum destination, and the only way to get a link to one.
 *
 * Holds the two things every protocol needs before it can talk to a node -
 * a path through the mesh, and the destination itself - and hands back links
 * that are already configured. Deliberately owns no link *lifetime* policy:
 * how many links a protocol keeps, and how many requests share one, differs
 * per protocol and lives with that protocol.
 *
 * `openLink()` is the single call site of `destination.createLink()` in the
 * codebase, which is what makes the bz2 injection below structural rather than
 * something each new protocol has to remember.
 */

import { Destination, DestType, type Link, type Reticulum } from '@reticulum/core'

import { config } from '../config'
import { rejectAfter, withDeadline } from './async'
import { bz2 } from './bz2'
import type { ReticulumStack } from './stack'

const settings = config.reticulum

export class RemoteDestination {
  readonly #stack: ReticulumStack
  readonly #destHash: Uint8Array
  readonly #destHashHex: string
  readonly #appName: string

  #destination: Promise<Destination> | null = null
  #pathPromise: Promise<void> | null = null
  #pathFailure: { error: Error; until: number } | null = null

  /**
   * @param appName The RNS app name and aspects, e.g. `rserver.web` or
   *   `nomadnetwork.node`. Protocol identity, not a setting - which is why it
   *   is an argument here and not an entry in config.ts.
   */
  constructor(stack: ReticulumStack, destHash: Uint8Array, destHashHex: string, appName: string) {
    this.#stack = stack
    this.#destHash = destHash
    this.#destHashHex = destHashHex
    this.#appName = appName
  }

  get destHashHex(): string {
    return this.#destHashHex
  }

  /**
   * Ensure a path to the destination is known.
   *
   * Kept public and separate from openLink so callers can fail fast *before*
   * queueing on a semaphore: twenty subresources of an unreachable host should
   * hit the cached failure, not each wait for a permit first.
   *
   * Every app launch is cold: the routing table is private to this process and
   * is not shared by rnsd, so requestPath is mandatory before the first fetch
   * no matter how long the daemon has been up. Deduplicated so a page with
   * twenty subresources broadcasts one path request, not twenty.
   */
  async ensurePath(): Promise<void> {
    const rns = await this.#stack.ready()

    if (rns.transport.hasPath(this.#destHash)) return

    if (this.#pathFailure && Date.now() < this.#pathFailure.until) {
      throw this.#pathFailure.error
    }

    this.#pathPromise ??= this.#discoverPath(rns)
      .catch((error: Error) => {
        this.#pathFailure = { error, until: Date.now() + settings.pathFailureTtl }
        throw error
      })
      .finally(() => {
        this.#pathPromise = null
      })

    await this.#pathPromise
  }

  /** Open a link, configured and registered with the stack. */
  async openLink(): Promise<Link> {
    const destination = await this.#resolveDestination()
    const link = await this.#createLink(destination)

    configureLink(link)
    this.#stack.trackLink(link)

    return link
  }

  /** Close a link opened here, and stop tracking it. Fire and forget. */
  closeLink(link: Link): void {
    this.#stack.untrackLink(link)
    closeQuietly(link)
  }

  /**
   * Close a link and wait for it.
   *
   * The shutdown path uses this rather than closeLink: teardown() sends
   * LINKCLOSE and needs the interface still up, so the stack cannot be stopped
   * until these have actually completed.
   */
  async releaseLink(link: Link): Promise<void> {
    this.#stack.untrackLink(link)
    await link.teardown().catch(() => {})
  }

  /**
   * Broadcast a path request and wait for the announce that answers it.
   *
   * Transport writes the routing-table entry immediately before dispatching
   * `announce`, so by the time the event fires hasPath() is already true.
   */
  async #discoverPath(rns: Reticulum): Promise<void> {
    const { transport } = rns
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

  /**
   * Establish a link, closing it if the deadline wins the race.
   *
   * Abandoning the promise is not enough: the link is already registered with
   * transport, and once it reaches ACTIVE it starts a 1-second watchdog that
   * rns.stop() does not cancel - which keeps Electron alive after the window
   * closes rather than failing loudly.
   */
  async #createLink(destination: Destination): Promise<Link> {
    const pending = destination.createLink()
    let abandoned = false

    pending.then(
      (link) => {
        if (abandoned) closeQuietly(link)
      },
      () => {}
    )

    try {
      return await withDeadline(
        pending,
        settings.linkEstablishmentTimeout,
        `Link establishment timeout after ${settings.linkEstablishmentTimeout / 1000}s`
      )
    } catch (error) {
      abandoned = true
      throw error
    }
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
    const rns = await this.#stack.ready()
    const identity = await Destination.recall(this.#destHash)

    if (!identity) {
      throw new Error(`Could not recall server identity for ${this.#destHashHex}`)
    }

    return Destination.OUT(this.#appName, DestType.SINGLE, identity, rns)
  }
}

/**
 * Apply the per-link settings every Reticulum link needs.
 *
 * `bz2` must be set before any resource advertisement arrives: Python RNS
 * bz2-compresses Resources and reticulum-js ships no codec, so without it
 * every fetch fails in Resource.assemble. This is invisible in JS-to-JS
 * testing - only a real Python peer exercises it. It applies to REQUEST
 * responses as much as to plain Resources, since Link passes `bz2` straight
 * into Resource.accept.
 */
function configureLink(link: Link): void {
  link.bz2 = bz2
  link.maxResourceSize = settings.maxResourceSize
}

/** Teardown is best-effort: a link we are done with may already be gone. */
export function closeQuietly(link: Link): void {
  void link.teardown().catch(() => {})
}

function sameHash(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }

  return true
}
