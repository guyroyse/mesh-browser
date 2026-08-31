import { app, BrowserWindow } from 'electron'

import { config } from './config'
import { registerProtocolSchemes, setupProtocols, teardownProtocols } from './protocols/protocols'
import { createMainWindow, setupWindowHandlers } from './windows'

let shuttingDown = false

registerProtocolSchemes()

app.whenReady().then(handleWhenReady)
app.on('window-all-closed', handleWindowAllClosed)
app.on('before-quit', handleBeforeQuit)

async function handleWhenReady() {
  setupProtocols()
  setupWindowHandlers()
  await createMainWindow()

  app.on('activate', handleActivate)
}

function handleActivate() {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
}

function handleWindowAllClosed() {
  if (process.platform !== 'darwin') app.quit()
}

/*
 * Electron does not await before-quit listeners, so the quit has to be
 * cancelled and re-issued once teardown finishes. Without this an ACTIVE link's
 * watchdog keeps the process alive after the window closes.
 */
async function handleBeforeQuit(event: Electron.Event) {
  if (shuttingDown) return

  event.preventDefault()
  shuttingDown = true

  /*
   * Whichever lands first: a clean teardown, or the budget running out. The
   * timer resolves rather than rejects on purpose - a client that will not
   * stop should delay the quit, not prevent it.
   */
  await Promise.race([
    teardownProtocols(),
    new Promise<void>((resolve) => setTimeout(resolve, config.shutdownTimeout))
  ])

  app.exit(0)
}
