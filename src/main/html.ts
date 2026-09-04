/**
 * HTML the browser itself generates: escaping, and the page shown when a
 * protocol cannot reach its content.
 *
 * Lives at the top level rather than under protocols/ because the micron
 * renderer needs the escaper too, and reticulum/ importing from protocols/
 * would invert the layering.
 */

import dedent from 'dedent'

export function escapeHtml(text: string): string {
  if (!text) return ''

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface ErrorPageOptions {
  /** What failed to load, e.g. "RWeb content" or "NomadNet page". */
  what: string
  /** What the user might do about it. */
  hint: string
}

/** A transport failure, as an HTTP 500 carrying a readable page. */
export function errorResponse(url: string, error: Error, options: ErrorPageOptions): Response {
  return new Response(errorPage(url, error.message, options), {
    status: 500,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

function errorPage(url: string, message: string, { what, hint }: ErrorPageOptions): string {
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
          <h2>Failed to load ${escapeHtml(what)}</h2>
          <p><strong>Error:</strong> ${escapeHtml(message)}</p>
          <p><strong>URL:</strong> <code>${escapeHtml(url)}</code></p>
          <p>${escapeHtml(hint)}</p>
        </div>
      </body>
    </html>
  `
}
