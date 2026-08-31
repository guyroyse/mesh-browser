/**
 * The protocol layer: which schemes exist, what serves them, and the lifetime
 * of the clients behind them.
 *
 * Split into three phases because Electron requires it - schemes must be
 * declared before app-ready, handlers can only be attached after, and clients
 * have to be stopped before the process exits.
 */

import { protocol } from 'electron'

import type { Startable, Stoppable } from '../lifecycle'
import { ReticulumClient } from '../reticulum/client'
import { createRwebHandler, rwebScheme } from './rweb'

/** One client per protocol for the life of the app. */
const reticulumClient = new ReticulumClient()

/** Declare schemes to Chromium. Must run *before* app-ready. */
export function registerProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([rwebScheme])
}

/** Attach handlers and bring clients up. Must run *after* app-ready. */
export function setupProtocols(): void {
  protocol.handle(rwebScheme.scheme, createRwebHandler(reticulumClient))

  warmUp('Reticulum', reticulumClient)
}

/** Stop every client. Bounded by the caller - see config.shutdownTimeout. */
export async function teardownProtocols(): Promise<void> {
  await shutDown('Reticulum', reticulumClient)
}

/**
 * Bring a client up, without blocking startup or being able to fail it.
 *
 * Deliberately not awaited. A client that cannot reach its daemon only means
 * that network is unavailable on this machine, which is not an app error.
 */
function warmUp(name: string, client: Startable): void {
  client
    .start()
    .then(() => console.log(`${name} client started`))
    .catch((error: Error) => console.warn(`${name} client unavailable:`, error.message))
}

/** One client failing to stop must not prevent the others from stopping. */
async function shutDown(name: string, client: Stoppable): Promise<void> {
  try {
    await client.stop()
    console.log(`${name} client stopped`)
  } catch (error) {
    console.error(`Failed to stop ${name} client cleanly:`, error)
  }
}
