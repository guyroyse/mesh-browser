const { ipcMain } = require('electron')
const { reticulumManager } = require('./process-managers')

// Initialize all IPC handlers
function setupIpcHandlers() {
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

module.exports = { setupIpcHandlers }
