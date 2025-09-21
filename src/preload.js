const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('meshBrowserAPI', {
  // System handler commands
  ping: () => ipcRenderer.invoke('system-ping'),
  version: () => ipcRenderer.invoke('system-version')
})
