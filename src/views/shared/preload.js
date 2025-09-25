const { contextBridge, ipcRenderer } = require('electron')

// Expose browser navigation API to renderer
contextBridge.exposeInMainWorld('browserAPI', {
  // Navigation methods
  navigate: (url) => ipcRenderer.invoke('navigate', url),
  goBack: () => ipcRenderer.invoke('goBack'),
  goForward: () => ipcRenderer.invoke('goForward'),
  refresh: () => ipcRenderer.invoke('refresh'),

  // Navigation state queries
  canGoBack: () => ipcRenderer.invoke('canGoBack'),
  canGoForward: () => ipcRenderer.invoke('canGoForward'),
  getURL: () => ipcRenderer.invoke('getURL'),

  // Event listeners for navigation updates
  onNavigationUpdate: (callback) => {
    ipcRenderer.on('navigation-update', (_, data) => callback(data))
  },

  onUrlChanged: (callback) => {
    ipcRenderer.on('url-changed', (_, url) => callback(url))
  }
})

// Expose original mesh browser API (for backward compatibility with about:// pages)
contextBridge.exposeInMainWorld('meshBrowserAPI', {
  version: () => ipcRenderer.invoke('system-version'),
  reticulumStatus: () => ipcRenderer.invoke('reticulum-status'),
  fetchPage: url => ipcRenderer.invoke('reticulum-fetch-page', { url })
})