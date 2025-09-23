const path = require('path')

const { app, BrowserWindow } = require('electron')
const { reticulumManager } = require('./process-managers')
const { registerProtocolSchemes, setupProtocolHandlers } = require('./protocol-handlers/protocol-schemes')

let mainWindow = null

registerProtocolSchemes()

app.whenReady().then(handleWhenReady)
app.on('window-all-closed', handleWindowAllClosed)
app.on('before-quit', handleBeforeQuit)

async function handleWhenReady() {
  await startReticulumBackend()
  setupProtocolHandlers()
  createWindow()

  app.on('activate', handleActivate)
}

function handleActivate() {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
}

function handleWindowAllClosed() {
  if (process.platform !== 'darwin') app.quit()
}

async function handleBeforeQuit() {
  await stopReticulumBackend()
}

async function startReticulumBackend() {
  try {
    await reticulumManager.start()
    console.log('Reticulum backend started successfully')
  } catch (error) {
    console.error('Failed to start Reticulum backend:', error)
  }
}

async function stopReticulumBackend() {
  try {
    await reticulumManager.stop()
    console.log('Reticulum backend stopped successfully')
  } catch (error) {
    console.error('Failed to stop Reticulum backend:', error)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allow custom protocols in webview
      webviewTag: true // Enable webview tag
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}
