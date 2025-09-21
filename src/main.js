const path = require('path')

const { app, BrowserWindow, protocol } = require('electron')
const { setupIpcHandlers } = require('./ipc-handlers')
const { reticulumManager } = require('./process-managers')

let mainWindow = null

// Register reticulum:// protocol scheme before app is ready
function setupReticulumProtocol() {
  protocol.registerSchemesAsPrivileged([{
    scheme: 'reticulum',
    privileges: {
      supportFetchAPI: true,
      corsEnabled: true,
      standard: true,
      secure: true,
      allowServiceWorkers: true,
      bypassCSP: false
    }
  }])
}

// Call before app.whenReady()
setupReticulumProtocol()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow custom protocols in webview
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(async () => {
  // Start Python backend
  try {
    await reticulumManager.start()
    console.log('Python backend started successfully')
  } catch (error) {
    console.error('Failed to start Python backend:', error)
    // Continue anyway for development
  }

  // Register the reticulum:// protocol handler
  setupReticulumProtocolHandler()

  setupIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Setup the actual protocol handler implementation
function setupReticulumProtocolHandler() {
  protocol.registerStreamProtocol('reticulum', async (request, callback) => {
    try {
      const url = request.url
      console.log(`Protocol handler: Fetching ${url}`)

      // Extract hash/path from reticulum://hash/path
      const reticulumUrl = url.substring(12) // Remove 'reticulum://'

      if (!reticulumUrl) {
        throw new Error('Invalid reticulum URL format')
      }

      // Fetch content using existing backend
      const response = await reticulumManager.sendCommand('fetch-page', { url: reticulumUrl })

      if (!response || !response.content) {
        throw new Error('No content received from Reticulum network')
      }

      // Decode base64 content
      const content = Buffer.from(response.content, 'base64')

      // Create readable stream for protocol handler
      const { Readable } = require('stream')
      const stream = new Readable({
        read() {
          this.push(content)
          this.push(null) // End stream
        }
      })

      // Return response with proper headers
      callback({
        statusCode: response.status_code || 200,
        headers: {
          'Content-Type': response.content_type || 'text/html',
          'Content-Length': content.length.toString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': '*'
        },
        data: stream
      })

      console.log(`Protocol handler: Successfully served ${content.length} bytes for ${url}`)

    } catch (error) {
      console.error('Protocol handler error:', error)

      // Return error page
      const errorHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Failed to Load</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .error { background: #fff5f5; border: 1px solid #fc8181; border-radius: 4px; padding: 20px; }
              h2 { color: #e53e3e; margin-top: 0; }
              code { background: #f7fafc; padding: 2px 4px; border-radius: 2px; }
            </style>
          </head>
          <body>
            <div class="error">
              <h2>Failed to load Reticulum content</h2>
              <p><strong>Error:</strong> ${escapeHtml(error.message)}</p>
              <p><strong>URL:</strong> <code>${escapeHtml(request.url)}</code></p>
              <p>Make sure the destination is reachable on the Reticulum network.</p>
            </div>
          </body>
        </html>
      `

      const errorStream = require('stream').Readable.from([Buffer.from(errorHtml, 'utf8')])

      callback({
        statusCode: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': Buffer.byteLength(errorHtml, 'utf8').toString()
        },
        data: errorStream
      })
    }
  })
}

// Utility function to escape HTML for error pages
function escapeHtml(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  // Shutdown Python backend
  try {
    await reticulumManager.stop()
  } catch (error) {
    console.error('Error stopping Python backend:', error)
  }
})
