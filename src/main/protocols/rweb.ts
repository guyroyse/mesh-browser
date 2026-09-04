/**
 * The rweb:// protocol: how a mesh URL becomes an HTTP response.
 *
 * Everything specific to rweb lives here - the scheme's privileges, the
 * request handler, and the failure page - so that adding a protocol means
 * adding a file beside this one rather than editing three.
 */

import dedent from 'dedent'

import type { RserverClient } from '../reticulum/rserver/client'
import { parseRwebUrl } from '../reticulum/rserver/url'

export const rwebScheme = {
  scheme: 'rweb',
  privileges: {
    supportFetchAPI: true,
    corsEnabled: true,
    standard: true,
    secure: true,
    allowServiceWorkers: true,
    bypassCSP: false
  }
}

/**
 * Build the handler Electron calls for every rweb:// request.
 *
 * A factory rather than a `setup` function that registers itself: the client
 * arrives as an argument instead of being reached for, and the returned
 * handler is an ordinary function that can be called directly.
 */
export function createRwebHandler(client: RserverClient) {
  return async function handleRequest(request: Request): Promise<Response> {
    console.log(`rweb: fetching ${request.url}`)

    try {
      const target = parseRwebUrl(new URL(request.url))
      const { body, headers, statusCode } = await client.fetch(target)

      /*
       * The remote server's status code and headers pass straight through - a
       * 404 from an rserver should render as a real 404 with its own body, not
       * our error page. Only transport failures throw.
       */
      return new Response(body, { status: statusCode, headers })
    } catch (error) {
      return errorResponse(request.url, error as Error)
    }
  }
}

function errorResponse(url: string, error: Error): Response {
  console.error('rweb: request failed:', error)

  return new Response(errorPage(url, error.message), {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

function errorPage(url: string, message: string): string {
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
          <p><strong>Error:</strong> ${escapeHtml(message)}</p>
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
