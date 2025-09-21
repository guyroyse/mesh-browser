const path = require('path')

const { app, BrowserWindow } = require('electron')
const { setupIpcHandlers } = require('./ipc-handlers')
const { reticulumManager } = require('./process-managers')

let mainWindow = null

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

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(async () => {
  // Start Python backend
  try {
    await reticulumManager.start()
    console.log('Python backend started successfully')
  } catch (error) {
    console.error('Failed to start Python backend:', error)
    // Continue anyway for development
  }

  setupIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  // Shutdown Python backend
  try {
    await reticulumManager.stop()
  } catch (error) {
    console.error('Error stopping Python backend:', error)
  }
})
