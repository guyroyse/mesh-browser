import { protocol } from 'electron'
import dedent from 'dedent'

import { pythonManager } from '@main/processes'

export function setupRwebHandler() {
  const httpPort = pythonManager.getHttpPort()
  const backendUrl = `http://localhost:${httpPort}/proxy/reticulum`

  protocol.handle('rweb', handleRequest)

  async function handleRequest(request: Request): Promise<Response> {
    console.log(`Protocol handler: Fetching ${request.url}`)

    try {
      const url = new URL(request.url)
      return await fetchFromBackend(url)
    } catch (error) {
      return createErrorResponse(request, error as Error)
    }
  }

  async function fetchFromBackend(url: URL): Promise<Response> {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        url: url.href.substring(7)
      })
    })

    const isBackendError = response.headers.get('X-Backend-Error') === 'true'
    if (isBackendError) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error ?? response.statusText ?? `HTTP ${response.status}`)
    }

    return response
  }

  function createErrorResponse(request: Request, error: Error): Response {
    console.error('Protocol handler error:', error)

    return new Response(generateErrorPage(request.url, error.message), {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  }

  function generateErrorPage(url: string, errorMessage: string): string {
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

  function escapeHtml(text: string): string {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}
