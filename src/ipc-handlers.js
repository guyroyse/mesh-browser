const { ipcMain } = require('electron')
const { pythonManager } = require('./python-manager')

// Initialize all IPC handlers
function setupIpcHandlers() {
  // Test IPC communication - now passes through to Python
  ipcMain.handle('get-test-message', async () => {
    try {
      // Send ping command to Python backend
      const response = await pythonManager.sendCommand('ping')
      return {
        message: 'IPC communication working!',
        timestamp: new Date().toISOString(),
        pong: response.pong
      }
    } catch (error) {
      // Fallback to Node.js response if Python fails
      return {
        message: `Python backend unavailable: ${error.message}`,
        timestamp: new Date().toISOString(),
        fallback: true
      }
    }
  })

  // Reticulum content fetching
  ipcMain.handle('fetch-page', async (event, url) => {
    try {
      // Send fetch-page command to Python backend
      const response = await pythonManager.sendCommand('fetch-page', { url })
      return response
    } catch (error) {
      throw new Error(`Failed to fetch content: ${error.message}`)
    }
  })

  // Future mesh networking handlers will go here:
  // ipcMain.handle('discover-servers', async () => {
  //   return pythonManager.sendCommand('discover-servers')
  // })
}

module.exports = { setupIpcHandlers }
