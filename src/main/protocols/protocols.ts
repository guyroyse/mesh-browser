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
import { RserverClient } from '../reticulum/rserver/client'
import { ReticulumStack } from '../reticulum/stack'
import { createRwebHandler, rwebScheme } from './rweb'

/*
 * One Reticulum stack shared by every protocol that rides it, and one client
 * per protocol, for the life of the app.
 */
const stack = new ReticulumStack()
const rserverClient = new RserverClient(stack)

/** Declare schemes to Chromium. Must run *before* app-ready. */
export function registerProtocolSchemes(): void {
  protocol.registerSchemesAsPrivileged([rwebScheme])
}

/** Attach handlers and bring clients up. Must run *after* app-ready. */
export function setupProtocols(): void {
  protocol.handle(rwebScheme.scheme, createRwebHandler(rserverClient))

  warmUp('rserver', rserverClient)
}

/**
 * Stop every client, then the stack. Bounded by the caller - see
 * config.shutdownTimeout.
 *
 * The order is load-bearing: a client's teardown sends LINKCLOSE and needs the
 * interface still up, and an ACTIVE link's 1-second watchdog is not cancelled
 * by stopping the stack. Getting this wrong hangs the quit rather than failing
 * loudly.
 */
export async function teardownProtocols(): Promise<void> {
  await shutDown('rserver', rserverClient)

  await shutDown('Reticulum stack', stack)
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
