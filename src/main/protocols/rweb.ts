/**
 * The rweb:// protocol: how a mesh URL becomes an HTTP response.
 *
 * Everything specific to rweb lives here - the scheme's privileges, the
 * request handler, and the failure page - so that adding a protocol means
 * adding a file beside this one rather than editing three.
 */

import { errorResponse } from '../html'
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
      return failed(request.url, error as Error)
    }
  }
}

function failed(url: string, error: Error): Response {
  console.error('rweb: request failed:', error)

  return errorResponse(url, error, {
    what: 'RWeb content',
    hint: 'Make sure the destination is reachable on the Reticulum network.'
  })
}
