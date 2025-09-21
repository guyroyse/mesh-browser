const { ipcMain } = require('electron')
const { reticulumManager } = require('./process-managers')

// Initialize all IPC handlers
function setupIpcHandlers() {
  // System ping command
  ipcMain.handle('system-ping', async () => {
    try {
      const response = await reticulumManager.sendCommand('ping')
      return response
    } catch (error) {
      throw new Error(`Ping failed: ${error.message}`)
    }
  })

  // System version command
  ipcMain.handle('system-version', async () => {
    try {
      const response = await reticulumManager.sendCommand('version')
      return response
    } catch (error) {
      throw new Error(`Version request failed: ${error.message}`)
    }
  })

  // Future mesh networking handlers will go here:
  // ipcMain.handle('discover-servers', async () => {
  //   return reticulumManager.sendCommand('discover-servers')
  // })
}

module.exports = { setupIpcHandlers }
