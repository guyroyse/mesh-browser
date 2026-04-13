import { BrowserWindow, WebContentsView, ipcMain, nativeTheme } from 'electron'

import { preloadPath, navigationUrl, statusUrl } from './config'

let mainWindow: BrowserWindow
let navigationView: WebContentsView
let webContentsView: WebContentsView
let statusView: WebContentsView

export async function createMainWindow(): Promise<BrowserWindow> {
  /* Create the main application window */
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
      // show: false
    }
  })

  /* Create web contents view for navigation (header) */
  navigationView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  })

  /* Create web contents view for main content (body) */
  webContentsView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow custom protocols
    }
  })

  /* Create web contents view for status (footer) */
  statusView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  })

  /* Add views to the main window's content view */
  mainWindow.contentView.addChildView(navigationView)
  mainWindow.contentView.addChildView(webContentsView)
  mainWindow.contentView.addChildView(statusView)

  /* Set up IPC handlers and view event listeners before loading content */
  setupIpcHandlers()
  setupViewEvents()

  /* Load content into views */
  await navigationView.webContents.loadURL(navigationUrl)
  await statusView.webContents.loadURL(statusUrl)

  /* Initial positioning of views and setup resize listener */
  positionViews()
  mainWindow.on('resize', positionViews)

  /* Set initial background color based on theme and listen for theme changes */
  webContentsView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff')
  nativeTheme.on('updated', () => {
    webContentsView.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#1a1a1a' : '#ffffff')
  })

  mainWindow.show()

  return mainWindow
}

function setupIpcHandlers() {
  ipcMain.handle('navigate', (_event, url: string) => {
    webContentsView.webContents.loadURL(url)
  })

  ipcMain.handle('goBack', () => {
    if (webContentsView.webContents.navigationHistory.canGoBack()) {
      webContentsView.webContents.navigationHistory.goBack()
    }
  })

  ipcMain.handle('goForward', () => {
    if (webContentsView.webContents.navigationHistory.canGoForward()) {
      webContentsView.webContents.navigationHistory.goForward()
    }
  })

  ipcMain.handle('refresh', () => {
    webContentsView.webContents.reload()
  })

  ipcMain.handle('canGoBack', () => {
    return webContentsView.webContents.navigationHistory.canGoBack()
  })

  ipcMain.handle('canGoForward', () => {
    return webContentsView.webContents.navigationHistory.canGoForward()
  })

  ipcMain.handle('getURL', () => {
    return webContentsView.webContents.getURL()
  })
}

function setupViewEvents() {
  webContentsView.webContents.on('did-navigate', (_event, url) => {
    navigationView.webContents.send('url-changed', url)
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-navigate-in-page', (_event, url) => {
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

  webContentsView.webContents.on('did-fail-load', (_event, _errorCode, errorDescription) => {
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
  const updateData = {
    canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
    canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
    isLoading: webContentsView.webContents.isLoading()
  }
  navigationView.webContents.send('navigation-update', updateData)
  statusView.webContents.send('navigation-update', updateData)
}

function positionViews() {
  /* Get the current size of the main window's content area */
  const { height, width } = mainWindow.getContentBounds()

  /* Calculate dimensions and positions for each view based on the main window size */
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

  /* Position navigation view at top */
  navigationView.setBounds({
    x: navigationViewX,
    y: navigationViewY,
    width: navigationViewWidth,
    height: navigationViewHeight
  })

  /* Position status view at bottom */
  statusView.setBounds({
    x: statusViewX,
    y: statusViewY,
    width: statusViewWidth,
    height: statusViewHeight
  })

  /* Position web content view in middle */
  webContentsView.setBounds({
    x: webContentViewX,
    y: webContentViewY,
    width: webContentViewWidth,
    height: webContentViewHeight
  })
}
