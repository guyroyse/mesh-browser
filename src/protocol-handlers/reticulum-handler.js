const { protocol } = require('electron')
const { reticulumManager } = require('../process-managers')

// Setup the protocol handler implementation (call after app is ready)
function setupReticulumHandler() {
  protocol.handle('reticulum', async (request) => {
    try {
      return await handleRequest(request)
    } catch (error) {
      return createErrorResponse(request, error)
    }
  })
}

// Handle reticulum:// requests
async function handleRequest(request) {
  const url = request.url
  console.log(`Protocol handler: Fetching ${url}`)

  // Extract hash/path from reticulum://hash/path
  const reticulumUrl = parseReticulumUrl(url)

  // Fetch content using Python backend
  const response = await fetchFromBackend(reticulumUrl)

  // Decode content and create Response
  const content = Buffer.from(response.content, 'base64')

  // Debug: Check if content looks like image data
  const isImage = response.content_type && response.content_type.startsWith('image/')
  if (isImage) {
    console.log(`Protocol handler: Serving image/${response.content_type} - ${content.length} bytes`)
    console.log(`Protocol handler: First 20 bytes: ${Array.from(content.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
  }

  console.log(`Protocol handler: Successfully served ${content.length} bytes for ${url}`)

  return new Response(content, {
    status: response.status_code || 200,
    headers: createResponseHeaders(response, content)
  })
}

// Parse reticulum:// URL to extract the hash/path portion
function parseReticulumUrl(url) {
  const reticulumUrl = url.substring(12) // Remove 'reticulum://'

  if (!reticulumUrl) {
    throw new Error('Invalid reticulum URL format')
  }

  return reticulumUrl
}

// Fetch content from Python backend via HTTP
async function fetchFromBackend(reticulumUrl) {
  // Get HTTP port from process manager
  const httpPort = reticulumManager.getHttpPort()
  if (!httpPort) {
    throw new Error('HTTP server not ready')
  }

  // Make HTTP request to /proxy/reticulum endpoint
  const response = await fetch(`http://localhost:${httpPort}/proxy/reticulum`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: reticulumUrl,
      method: 'GET'
    })
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch (e) {
      // If response isn't JSON, use status text
      errorMessage = response.statusText || errorMessage
    }
    throw new Error(errorMessage)
  }

  // Return response data that matches expected format
  const contentBuffer = await response.arrayBuffer()
  const content = Buffer.from(contentBuffer).toString('base64')

  return {
    content: content,
    content_type: response.headers.get('content-type') || 'text/html',
    status_code: response.status
  }
}

// Create response headers
function createResponseHeaders(response, content) {
  return {
    'Content-Type': response.content_type || 'text/html',
    'Content-Length': content.length.toString(),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': '*'
  }
}

// Create error response for failed requests
function createErrorResponse(request, error) {
  console.error('Protocol handler error:', error)

  const errorHtml = generateErrorPage(request.url, error.message)

  return new Response(errorHtml, {
    status: 500,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  })
}

// Generate HTML error page
function generateErrorPage(url, errorMessage) {
  return `
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

module.exports = { setupReticulumHandler }