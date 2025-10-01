const { protocol } = require('electron')
const { pythonManager } = require('../process-managers')
const dedent = require('dedent')

function setupRwebHandler() {
  const httpPort = pythonManager.getHttpPort()
  const backendUrl = `http://localhost:${httpPort}/proxy/reticulum`

  protocol.handle('rweb', handleRequest)

  async function handleRequest(request) {
    console.log(`Protocol handler: Fetching ${request.url}`)

    try {
      const url = new URL(request.url)
      return await fetchFromBackend(url)
    } catch (error) {
      return createErrorResponse(request, error)
    }
  }

  async function fetchFromBackend(url) {
    // Forward the request to the Reticulum backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        url: url.href.substring(7)
      })
    })

    // If the backend indicates an error, generate an error page
    const isBackendError = response.headers.get('X-Backend-Error') === 'true'
    if (isBackendError) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error ?? response.statusText ?? `HTTP ${response.status}`)
    }

    // Return the HTTP Response directly
    return response
  }

  function createErrorResponse(request, error) {
    console.error('Protocol handler error:', error)

    return new Response(generateErrorPage(request.url, error.message), {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }

  // Generate HTML error page
  function generateErrorPage(url, errorMessage) {
    return dedent`
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
            <h2>Failed to load RWeb content</h2>
            <p><strong>Error:</strong> ${escapeHtml(errorMessage)}</p>
            <p><strong>URL:</strong> <code>${escapeHtml(url)}</code></p>
            <p>Make sure the destination is reachable on the Reticulum network.</p>
          </div>
        </body>
      </html>
    `
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
}

module.exports = { setupRwebHandler }
