const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('meshBrowserAPI', {
  // Test function to verify IPC works
  getTestMessage: () => ipcRenderer.invoke('get-test-message')
})
