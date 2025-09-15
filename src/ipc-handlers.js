const { ipcMain } = require('electron')
const { pythonManager } = require('./python-manager')

// Initialize all IPC handlers
function setupIpcHandlers() {
  // Test IPC communication - now passes through to Python
  ipcMain.handle('get-test-message', async () => {
    try {
      // Send command to Python backend
      const response = await pythonManager.sendCommand('get-test-message')
      return response
    } catch (error) {
      // Fallback to Node.js response if Python fails
      return {
        message: `Python backend unavailable: ${error.message}`,
        timestamp: new Date().toISOString(),
        fallback: true
      }
    }
  })

  // Future mesh networking handlers will go here:
  // ipcMain.handle('discover-servers', async () => {
  //   return pythonManager.sendCommand('discover-servers')
  // })
}

module.exports = { setupIpcHandlers }
