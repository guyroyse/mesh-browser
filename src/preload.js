const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('meshBrowserAPI', {
  version: () => ipcRenderer.invoke('system-version'),
  reticulumStatus: () => ipcRenderer.invoke('reticulum-status'),
  fetchPage: url => ipcRenderer.invoke('reticulum-fetch-page', { url })
})
