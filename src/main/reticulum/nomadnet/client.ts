/**
 * Fetches NomadNet page source over RNS Links.
 *
 * Returns micron, not HTML: rendering happens at the protocol boundary in
 * protocols/nomadnet.ts, mirroring the way RserverClient hands back a parsed
 * response for rweb.ts to wrap. Keeping the two apart is also what makes the
 * micron renderer reachable without a network.
 */

import type { Lifecycle } from '../../lifecycle'
import { RemoteDestination } from '../destination'
import type { ReticulumStack } from '../stack'
import { NodeLink } from './node-link'
import type { NomadnetTarget } from './url'

/* NomadNet nodes listen on the "nomadnetwork.node" aspect - protocol
   identity, not a setting */
export const NOMADNET_APP_NAME = 'nomadnetwork.node'

export class NomadnetClient implements Lifecycle {
  readonly #stack: ReticulumStack
  #stopped = false
  #nodes = new Map<string, NodeLink>()

  constructor(stack: ReticulumStack) {
    this.#stack = stack
  }

  /** Warming the shared stack is all there is to start for this client. */
  async start(): Promise<void> {
    this.#stopped = false
    await this.#stack.start()
  }

  /**
   * Fetch a page's micron source.
   *
   * The stack starts itself on first use, so a first attempt that failed
   * because rnsd was not running recovers on the next navigation rather than
   * leaving the app dead until it is restarted.
   */
  async fetch(target: NomadnetTarget): Promise<string> {
    if (this.#stopped) throw new Error('NomadNet client is shutting down')

    const node = this.#nodeFor(target)
    const response = await node.request(target.path)

    return decodePage(response, target.path)
  }

  /**
   * Tear down every link.
   *
   * The stack is stopped separately and *after* this - teardown() sends
   * LINKCLOSE and needs the interface still up.
   */
  async stop(): Promise<void> {
    this.#stopped = true

    const nodes = [...this.#nodes.values()]
    this.#nodes.clear()

    await Promise.all(nodes.map((node) => node.drain()))
  }

  #nodeFor(target: NomadnetTarget): NodeLink {
    let node = this.#nodes.get(target.destHashHex)

    if (!node) {
      const destination = new RemoteDestination(
        this.#stack,
        target.destHash,
        target.destHashHex,
        NOMADNET_APP_NAME
      )

      node = new NodeLink(destination, {
        /* Drop the entry once the node goes quiet, so browsing many nodes does
           not accumulate a map entry per destination for the whole session */
        onDispose: () => {
          if (this.#nodes.get(target.destHashHex) === node) {
            this.#nodes.delete(target.destHashHex)
          }
        }
      })

      this.#nodes.set(target.destHashHex, node)
    }

    return node
  }
}

/**
 * Turn a RESPONSE value into page source.
 *
 * msgpack maps Python `bytes` and `str` to different types, and NomadNet nodes
 * produce both in the wild - a static page read from disk arrives as bytes, a
 * dynamic page's stdout can arrive as a string. `null` is what serve_page
 * returns when it fails outright, and there is no status code to tell us so.
 */
function decodePage(response: unknown, path: string): string {
  if (typeof response === 'string') return response

  if (response instanceof Uint8Array) {
    return new TextDecoder('utf-8', { fatal: false }).decode(response)
  }

  throw new Error(`Node returned no page content for ${path}`)
}
