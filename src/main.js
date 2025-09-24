const path = require('path')

const { app, BrowserWindow, WebContentsView } = require('electron')
const { reticulumManager } = require('./process-managers')
const { registerProtocolSchemes, setupProtocolHandlers } = require('./protocol-handlers/protocol-schemes')
const { setupIpcHandlers } = require('./ipc-handlers')

let mainWindow = null
let webContentsView = null

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
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // Create web contents view for web content
  webContentsView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow custom protocols
    }
  })

  mainWindow.contentView.addChildView(webContentsView)

  // Position web contents view below the navigation bar (estimate ~80px height)
  const bounds = mainWindow.getContentBounds()
  webContentsView.setBounds({ x: 0, y: 80, width: bounds.width, height: bounds.height - 80 - 30 }) // 30px for footer

  // Handle window resize
  mainWindow.on('resize', () => {
    const bounds = mainWindow.getContentBounds()
    webContentsView.setBounds({ x: 0, y: 80, width: bounds.width, height: bounds.height - 80 - 30 })
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  setupIpcHandlers(mainWindow, webContentsView)
}

