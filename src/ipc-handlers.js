const { ipcMain } = require('electron')
const { reticulumManager } = require('./process-managers')

let webContentsView = null
let mainWindow = null

// Initialize IPC handlers with references to main window and web contents view
function setupIpcHandlers(mainWin, webView) {
  mainWindow = mainWin
  webContentsView = webView

  setupNavigationHandlers()
  setupMeshBrowserHandlers()
  setupWebContentsViewEvents()
}

// Browser navigation IPC handlers
function setupNavigationHandlers() {
  ipcMain.handle('navigate', (_, url) => {
    if (webContentsView) {
      webContentsView.webContents.loadURL(url)
    }
  })

  ipcMain.handle('goBack', () => {
    if (webContentsView && webContentsView.webContents.navigationHistory.canGoBack()) {
      webContentsView.webContents.navigationHistory.goBack()
    }
  })

  ipcMain.handle('goForward', () => {
    if (webContentsView && webContentsView.webContents.navigationHistory.canGoForward()) {
      webContentsView.webContents.navigationHistory.goForward()
    }
  })

  ipcMain.handle('refresh', () => {
    if (webContentsView) {
      webContentsView.webContents.reload()
    }
  })

  ipcMain.handle('canGoBack', () => {
    return webContentsView ? webContentsView.webContents.navigationHistory.canGoBack() : false
  })

  ipcMain.handle('canGoForward', () => {
    return webContentsView ? webContentsView.webContents.navigationHistory.canGoForward() : false
  })

  ipcMain.handle('getURL', () => {
    return webContentsView ? webContentsView.webContents.getURL() : ''
  })
}

// Original mesh browser API handlers (for about:// pages)
function setupMeshBrowserHandlers() {
  // System version command
  ipcMain.handle('system-version', async () => {
    try {
      return await reticulumManager.sendCommand('version')
    } catch (error) {
      throw new Error(`Version request failed: ${error.message}`)
    }
  })

  // Reticulum network handlers
  ipcMain.handle('reticulum-status', async () => {
    try {
      return await reticulumManager.sendCommand('reticulum-status')
    } catch (error) {
      throw new Error(`Reticulum status request failed: ${error.message}`)
    }
  })

  ipcMain.handle('reticulum-fetch-page', async (event, { url }) => {
    try {
      return await reticulumManager.sendCommand('fetch-page', { url })
    } catch (error) {
      throw new Error(`Reticulum fetch-page failed: ${error.message}`)
    }
  })
}

// Set up event forwarding from WebContentsView to main window
function setupWebContentsViewEvents() {
  if (!webContentsView) return

  webContentsView.webContents.on('did-navigate', (event, url) => {
    mainWindow.webContents.send('url-changed', url)
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-navigate-in-page', (event, url) => {
    mainWindow.webContents.send('url-changed', url)
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('navigation-update', {
      canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
      canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
      isLoading: true
    })
  })

  webContentsView.webContents.on('did-stop-loading', () => {
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    mainWindow.webContents.send('navigation-update', {
      canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
      canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
      isLoading: false,
      error: errorDescription
    })
  })
}

function sendNavigationUpdate() {
  if (webContentsView && mainWindow) {
    mainWindow.webContents.send('navigation-update', {
      canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
      canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
      isLoading: webContentsView.webContents.isLoading()
    })
  }
}

module.exports = { setupIpcHandlers }