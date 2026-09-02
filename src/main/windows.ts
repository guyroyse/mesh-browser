import { BrowserWindow, WebContentsView, ipcMain, nativeTheme } from 'electron'

import { config } from './config'
import { preloadPath, navigationUrl, statusUrl, iconPath } from './paths'
import { contentBackground } from './theme'
import type { NavigationUpdate } from '../shared/ipc'

/*
 * One window's worth of views. Multi-window will need these per window, with
 * IPC routed by event.sender to the calling window's content view - see
 * setupWindowHandlers.
 */
let mainWindow: BrowserWindow
let navigationView: WebContentsView
let webContentsView: WebContentsView
let statusView: WebContentsView

/**
 * Register what belongs to the app rather than to any one window.
 *
 * Must be called exactly once, before the first window: ipcMain.handle throws
 * if a channel already has a handler, and every extra nativeTheme listener
 * leaks. Creating a second window used to re-run both.
 */
export function setupWindowHandlers(): void {
  setupIpcHandlers()
  nativeTheme.on('updated', applyContentBackground)
}

export async function createMainWindow(): Promise<BrowserWindow> {
  /* Create the main application window */
  mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    /* Linux has no icon anywhere else; Windows and macOS ignore this and take
     * theirs from the executable and the bundle that electron-builder signs. */
    icon: iconPath,
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

  /* Per-window wiring; the app-wide handlers are registered separately */
  setupViewEvents()

  /* Load content into views */
  await navigationView.webContents.loadURL(navigationUrl)
  await statusView.webContents.loadURL(statusUrl)

  /*
   * Re-lay out whenever the content area changes size.
   *
   * `bounds-changed` is emitted by Chromium's own view layout rather than by a
   * window-manager event, so it fires the same way everywhere - including on
   * compositors that never deliver maximize or resize to Electron - and the
   * new bounds are readable by the time it arrives. `resize` stays as a
   * backstop for ordinary drag-resizing; positionViews is idempotent, so both
   * firing costs nothing.
   */
  mainWindow.contentView.on('bounds-changed', positionViews)
  mainWindow.on('resize', positionViews)

  positionViews()

  /* The OS-theme listener is registered once in setupWindowHandlers */
  applyContentBackground()

  mainWindow.show()

  return mainWindow
}

/* Keeps a mesh page from flashing white before it paints */
function applyContentBackground() {
  const { dark, light } = contentBackground

  /* The theme can flip after handlers are registered but before a window exists */
  webContentsView?.setBackgroundColor(nativeTheme.shouldUseDarkColors ? dark : light)
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
    /*
     * No url: nothing has committed yet, so getURL() still reports the page we
     * are navigating away from. The status bar says a plain "Loading..." until
     * did-navigate arrives with the real destination.
     */
    sendNavigationUpdate({ isLoading: true, url: undefined })
  })

  webContentsView.webContents.on('did-stop-loading', () => {
    sendNavigationUpdate()
  })

  webContentsView.webContents.on('did-fail-load', (_event, _errorCode, errorDescription) => {
    sendNavigationUpdate({ isLoading: false, error: errorDescription })
  })

  /*
   * Chromium sends the hovered link's URL, and an empty string when the pointer
   * leaves it - so the clear is the same message, and the renderer needs no
   * separate "hover ended" channel. Sent only to the status view: unlike
   * navigation state, nothing in the navigation chrome renders this.
   */
  webContentsView.webContents.on('update-target-url', (_event, url) => {
    statusView.webContents.send('target-url-changed', url)
  })
}

/**
 * Push the current navigation state to both chrome views.
 *
 * Every field is derived here so that callers only state what they know
 * differently - a caller that hand-built the whole payload could, and did,
 * silently omit one.
 */
function sendNavigationUpdate(overrides: Partial<NavigationUpdate> = {}) {
  broadcast('navigation-update', {
    canGoBack: webContentsView.webContents.navigationHistory.canGoBack(),
    canGoForward: webContentsView.webContents.navigationHistory.canGoForward(),
    isLoading: webContentsView.webContents.isLoading(),
    url: webContentsView.webContents.getURL(),
    ...overrides
  })
}

/* Both chrome views render navigation state; neither should have to be
   remembered separately at each call site */
function broadcast(channel: string, payload: unknown) {
  navigationView.webContents.send(channel, payload)
  statusView.webContents.send(channel, payload)
}

function positionViews() {
  /*
   * Read the size from the view tree rather than from the window. Child views
   * are positioned relative to contentView, and this is the value Chromium has
   * just finished laying out - getContentBounds() can still report the old
   * size when a window-manager event arrives early.
   */
  const { height, width } = mainWindow.contentView.getBounds()

  /* Calculate dimensions and positions for each view based on the main window size */
  const navigationViewHeight = 50
  const navigationViewWidth = width
  const navigationViewX = 0
  const navigationViewY = 0

  const statusViewHeight = 25
  const statusViewWidth = width
  const statusViewX = 0
  const statusViewY = height - statusViewHeight

  /* Clamped: a minimized or very short window would otherwise go negative */
  const webContentViewHeight = Math.max(0, height - navigationViewHeight - statusViewHeight)
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
