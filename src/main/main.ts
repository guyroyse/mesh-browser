import { app, BrowserWindow } from 'electron'

import { reticulumClient } from './reticulum'
import { registerProtocolSchemes, setupProtocolHandlers } from '@protocol-handlers/protocol-schemes'
import { createMainWindow } from './windows'

/* Links run a 1-second watchdog; don't let a stuck teardown hang the quit */
const SHUTDOWN_TIMEOUT = 5000

let shuttingDown = false

registerProtocolSchemes()

app.whenReady().then(handleWhenReady)
app.on('window-all-closed', handleWindowAllClosed)
app.on('before-quit', handleBeforeQuit)

async function handleWhenReady() {
  await startReticulum()
  setupProtocolHandlers()
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

  await stopReticulum()
  app.exit(0)
}

async function startReticulum() {
  try {
    await reticulumClient.start()
    console.log('Reticulum client started successfully')
  } catch (error) {
    /*
     * Keep going: the window still opens, and the failure is reported on the
     * error page when the user tries to navigate.
     */
    console.error('Failed to start Reticulum client:', error)
  }
}

async function stopReticulum() {
  try {
    await withTimeout(reticulumClient.stop(), SHUTDOWN_TIMEOUT)
    console.log('Reticulum client stopped successfully')
  } catch (error) {
    console.error('Failed to stop Reticulum client cleanly:', error)
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))])
}
