const { protocol } = require('electron')
const { pythonManager } = require('../process-managers')

// Fetch status from Python backend via HTTP
async function fetchStatus() {
  const httpPort = pythonManager.getHttpPort()
  if (!httpPort) {
    throw new Error('HTTP server not ready')
  }

  const response = await fetch(`http://localhost:${httpPort}/api/status`)

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch (e) {
      errorMessage = response.statusText || errorMessage
    }
    throw new Error(errorMessage)
  }

  return await response.json()
}

// Setup the about protocol handler implementation (call after app is ready)
function setupAboutHandler() {
  protocol.handle('about', async (request) => {
    try {
      return await handleAboutRequest(request)
    } catch (error) {
      return createAboutErrorResponse(request, error)
    }
  })
}

// Handle about:// requests
async function handleAboutRequest(request) {
  const url = request.url
  console.log(`About protocol handler: ${url}`)

  // Extract page type from about:page
  const aboutPage = parseAboutUrl(url)

  // Generate the appropriate page content
  const html = await generateAboutPage(aboutPage)

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

// Parse about:// URL to extract the page type
function parseAboutUrl(url) {
  const aboutPage = url.substring(6) // Remove 'about:'

  if (!aboutPage) {
    return 'system' // Default to system page
  }

  return aboutPage
}

// Generate HTML content for about pages
async function generateAboutPage(pageType) {
  const baseStyles = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 40px;
        background: #f5f5f5;
        color: #333;
      }
      .about-page {
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        max-width: 800px;
        margin: 0 auto;
      }
      h2 { color: #2d3748; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
      th { background: #f7fafc; font-weight: 600; }
      .status-indicator {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 8px;
      }
      .connected { background: #48bb78; }
      .disconnected { background: #f56565; }
      .nav-links {
        margin: 20px 0;
        padding: 15px;
        background: #edf2f7;
        border-radius: 4px;
      }
      .nav-links a {
        color: #3182ce;
        text-decoration: none;
        margin-right: 15px;
      }
      .nav-links a:hover { text-decoration: underline; }
    </style>
  `

  switch (pageType) {
    case 'system':
      return await generateSystemPage(baseStyles)
    case 'reticulum':
      return await generateReticulumPage(baseStyles)
    default:
      return generateNotFoundPage(baseStyles, pageType)
  }
}

// Generate system information page
async function generateSystemPage(styles) {
  try {
    const data = await fetchStatus()

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>System Information</title>
          ${styles}
        </head>
        <body>
          <div class="about-page">
            <h2>System Information</h2>
            <div class="nav-links">
              <a href="about:system">System</a>
              <a href="about:reticulum">Reticulum</a>
            </div>
            <table>
              <tr>
                <th>Python Version</th>
                <td>${data.python_version || 'Not available'}</td>
              </tr>
              <tr>
                <th>Working Directory</th>
                <td>${data.working_directory || 'Not available'}</td>
              </tr>
              <tr>
                <th>Timestamp</th>
                <td>${data.timestamp || 'Not available'}</td>
              </tr>
              <tr>
                <th>Backend Status</th>
                <td><span class="status-indicator connected"></span>Connected</td>
              </tr>
            </table>
            <p><strong>Backend Communication:</strong> ✅ Working correctly</p>
          </div>
        </body>
      </html>
    `
  } catch (error) {
    throw new Error(`Failed to load system information: ${error.message}`)
  }
}

// Generate Reticulum status page
async function generateReticulumPage(styles) {
  try {
    const data = await fetchStatus()

    const statusIndicator = data.initialized ? 'connected' : 'disconnected'
    const statusText = data.initialized ? 'Initialized' : 'Not initialized'

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reticulum Network Status</title>
          ${styles}
        </head>
        <body>
          <div class="about-page">
            <h2>Reticulum Network Status</h2>
            <div class="nav-links">
              <a href="about:system">System</a>
              <a href="about:reticulum">Reticulum</a>
            </div>
            <table>
              <tr>
                <th>Network Status</th>
                <td><span class="status-indicator ${statusIndicator}"></span>${statusText}</td>
              </tr>
              <tr>
                <th>Identity Hash</th>
                <td>${data.identity_hash || 'Not available'}</td>
              </tr>
              <tr>
                <th>Active Interfaces</th>
                <td>${data.interfaces ? data.interfaces.length : 0}</td>
              </tr>
            </table>
            ${data.interfaces && data.interfaces.length > 0 ? `
              <h3>Network Interfaces</h3>
              <table>
                <thead>
                  <tr>
                    <th>Interface</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.interfaces.map(iface => `
                    <tr>
                      <td>${iface.name || 'Unknown'}</td>
                      <td>${iface.type || 'Unknown'}</td>
                      <td><span class="status-indicator ${iface.status === 'active' ? 'connected' : 'disconnected'}"></span>${iface.status || 'Unknown'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p>No network interfaces available.</p>'}
          </div>
        </body>
      </html>
    `
  } catch (error) {
    throw new Error(`Failed to load Reticulum status: ${error.message}`)
  }
}

// Generate 404 page for unknown about pages
function generateNotFoundPage(styles, pageType) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Page Not Found</title>
        ${styles}
      </head>
      <body>
        <div class="about-page">
          <h2>Page Not Found</h2>
          <div class="nav-links">
            <a href="about:system">System</a>
            <a href="about:reticulum">Reticulum</a>
          </div>
          <p>The about page "${escapeHtml(pageType)}" was not found.</p>
          <p>Available pages:</p>
          <ul>
            <li><a href="about:system">about:system</a> - System information</li>
            <li><a href="about:reticulum">about:reticulum</a> - Reticulum network status</li>
          </ul>
        </div>
      </body>
    </html>
  `
}

// Create error response for failed about requests
function createAboutErrorResponse(request, error) {
  console.error('About protocol handler error:', error)

  const errorHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Error Loading Page</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .error { background: #fff5f5; border: 1px solid #fc8181; border-radius: 4px; padding: 20px; }
          h2 { color: #e53e3e; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>Error Loading About Page</h2>
          <p><strong>Error:</strong> ${escapeHtml(error.message)}</p>
          <p><strong>URL:</strong> ${escapeHtml(request.url)}</p>
        </div>
      </body>
    </html>
  `

  return new Response(errorHtml, {
    status: 500,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  })
}

// Utility function to escape HTML
function escapeHtml(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = { setupAboutHandler }