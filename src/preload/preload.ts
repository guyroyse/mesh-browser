import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('browserAPI', {
  navigate: (url: string) => ipcRenderer.invoke('navigate', url),
  goBack: () => ipcRenderer.invoke('goBack'),
  goForward: () => ipcRenderer.invoke('goForward'),
  refresh: () => ipcRenderer.invoke('refresh'),

  canGoBack: () => ipcRenderer.invoke('canGoBack'),
  canGoForward: () => ipcRenderer.invoke('canGoForward'),
  getURL: () => ipcRenderer.invoke('getURL'),

  onNavigationUpdate: (callback: (data: unknown) => void) => {
    ipcRenderer.on('navigation-update', (_event, data) => callback(data))
  },

  onUrlChanged: (callback: (url: string) => void) => {
    ipcRenderer.on('url-changed', (_event, url) => callback(url))
  },

  /* Empty string means the pointer left the link; see update-target-url in windows.ts */
  onTargetUrlChanged: (callback: (url: string) => void) => {
    ipcRenderer.on('target-url-changed', (_event, url) => callback(url))
  }
})
