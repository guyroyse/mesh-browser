const path = require('path')

const { app, BrowserWindow, WebContentsView, nativeTheme } = require('electron')
const { reticulumManager } = require('./process-managers')
const { registerProtocolSchemes, setupProtocolHandlers } = require('./protocol-handlers/protocol-schemes')
const { setupIpcHandlers } = require('./ipc-handlers')

let mainWindow = null
let navigationView = null
let statusView = null
let webContentsView = null

registerProtocolSchemes()

app.whenReady().then(handleWhenReady)
app.on('window-all-closed', handleWindowAllClosed)
app.on('before-quit', handleBeforeQuit)

async function handleWhenReady() {
  await startReticulumBackend()
  setupProtocolHandlers()
  await createWindow()

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

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      show: false // Don't show main window, we only use views
    }
  })

  // Create navigation view (header)
  navigationView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'views', 'shared', 'preload.js')
    }
  })

  // Create web contents view for web content (middle)
  webContentsView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow custom protocols
    }
  })

  // Create status view (footer)
  statusView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'views', 'shared', 'preload.js')
    }
  })

  // Add all views to main window
  mainWindow.contentView.addChildView(navigationView)
  mainWindow.contentView.addChildView(webContentsView)
  mainWindow.contentView.addChildView(statusView)

  // Load content for each view
  await navigationView.webContents.loadFile(path.join(__dirname, 'views', 'navigation', 'index.html'))
  await statusView.webContents.loadFile(path.join(__dirname, 'views', 'status', 'index.html'))

  // Make sure views are repositioned on window resize
  positionViews()
  mainWindow.on('resize', positionViews)

  // Update webContentsView background when theme changes
  webContentsView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff')
  nativeTheme.on('updated', () => {
    webContentsView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff')
  })

  // Show the window
  mainWindow.show()

  setupIpcHandlers(mainWindow, navigationView, statusView, webContentsView)
}

function positionViews() {
  const { height, width } = mainWindow.getContentBounds()

  const navigationViewHeight = 50
  const navigationViewWidth = width
  const navigationViewX = 0
  const navigationViewY = 0

  const statusViewHeight = 25
  const statusViewWidth = width
  const statusViewX = 0
  const statusViewY = height - statusViewHeight

  const webContentViewHeight = height - navigationViewHeight - statusViewHeight
  const webContentViewWidth = width
  const webContentViewX = 0
  const webContentViewY = navigationViewHeight

  // Position navigation view at top
  navigationView.setBounds({
    x: navigationViewX,
    y: navigationViewY,
    width: navigationViewWidth,
    height: navigationViewHeight
  })

  // Position status view at bottom
  statusView.setBounds({
    x: statusViewX,
    y: statusViewY,
    width: statusViewWidth,
    height: statusViewHeight
  })

  // Position web content view in middle
  webContentsView.setBounds({
    x: webContentViewX,
    y: webContentViewY,
    width: webContentViewWidth,
    height: webContentViewHeight
  })
}
