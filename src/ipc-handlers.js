const { ipcMain } = require('electron')

let navigationView = null
let statusView = null
let webContentsView = null
let mainWindow = null

// Initialize IPC handlers with references to all views
function setupIpcHandlers(mainWin, navView, statView, webView) {
  mainWindow = mainWin
  navigationView = navView
  statusView = statView
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

// Mesh browser API handlers - removed, now use HTTP directly
// Protocol handlers (reticulum-handler.js, about-handler.js) communicate
// with Python backend via HTTP instead of IPC
function setupMeshBrowserHandlers() {
  // No handlers needed - keeping function for backwards compatibility
}

// Set up event forwarding from WebContentsView to main window
function setupWebContentsViewEvents() {
  if (!webContentsView) return

  webContentsView.webContents.on('did-navigate', (event, url) => {
    // Send URL changes to navigation view
    navigationView.webContents.send('url-changed', url)
    // Send navigation updates to both navigation and status views
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-navigate-in-page', (event, url) => {
    navigationView.webContents.send('url-changed', url)
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-start-loading', () => {
    const updateData = {
      canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
      canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
      isLoading: true
    }

    navigationView.webContents.send('navigation-update', updateData)
    statusView.webContents.send('navigation-update', updateData)
  })

  webContentsView.webContents.on('did-stop-loading', () => {
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    const updateData = {
      canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
      canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
      isLoading: false,
      error: errorDescription
    }

    navigationView.webContents.send('navigation-update', updateData)
    statusView.webContents.send('navigation-update', updateData)
  })
}

function sendNavigationUpdate() {
  if (webContentsView && navigationView && statusView) {
    const updateData = {
      canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
      canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
      isLoading: webContentsView.webContents.isLoading()
    }

    navigationView.webContents.send('navigation-update', updateData)
    statusView.webContents.send('navigation-update', updateData)
  }
}

module.exports = { setupIpcHandlers }