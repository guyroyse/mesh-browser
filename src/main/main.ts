import { app, BrowserWindow } from 'electron'

import { pythonManager } from './processes'
import { registerProtocolSchemes, setupProtocolHandlers } from '@protocol-handlers/protocol-schemes'
import { createMainWindow } from './windows'

registerProtocolSchemes()

app.whenReady().then(handleWhenReady)
app.on('window-all-closed', handleWindowAllClosed)
app.on('before-quit', handleBeforeQuit)

async function handleWhenReady() {
  await startReticulumBackend()
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

async function handleBeforeQuit() {
  await stopReticulumBackend()
}

async function startReticulumBackend() {
  try {
    await pythonManager.start()
    console.log('Reticulum backend started successfully')
  } catch (error) {
    console.error('Failed to start Reticulum backend:', error)
  }
}

async function stopReticulumBackend() {
  try {
    await pythonManager.stop()
    console.log('Reticulum backend stopped successfully')
  } catch (error) {
    console.error('Failed to stop Reticulum backend:', error)
  }
}
