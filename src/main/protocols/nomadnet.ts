/**
 * The nomadnet:// protocol: how a NomadNet page becomes an HTML response.
 *
 * Everything specific to nomadnet lives here - the scheme's privileges, the
 * request handler, and the micron render pipeline - so that adding a protocol
 * means adding a file beside this one rather than editing three.
 */

import { errorResponse } from '../html'
import type { NomadnetClient } from '../reticulum/nomadnet/client'
import { parseMicron } from '../reticulum/nomadnet/micron/parse'
import { renderBlocks } from '../reticulum/nomadnet/micron/render'
import { micronPage } from '../reticulum/nomadnet/micron/page'
import { isFilePath, parseNomadnetUrl } from '../reticulum/nomadnet/url'

export const nomadnetScheme = {
  scheme: 'nomadnet',
  privileges: {
    /*
     * Deliberately tighter than rweb. A NomadNet page is micron, which cannot
     * script, so nothing in one can call fetch, register a worker, or make a
     * cross-origin request - and it should not be able to start.
     *
     * `standard` is what earns the page a real origin and makes Chromium
     * resolve its relative links against it, which is the whole reason micron
     * link targets can be passed through untouched.
     */
    standard: true,
    secure: true,
    supportFetchAPI: false,
    corsEnabled: false,
    allowServiceWorkers: false,
    bypassCSP: false
  }
}

/**
 * Build the handler Electron calls for every nomadnet:// request.
 *
 * Note the deliberate difference from rweb: there is no status code to pass
 * through. RNS REQUEST/RESPONSE has no notion of one, and NomadNet's own
 * refusals - an unauthorised page, say - come back as ordinary micron that
 * renders like any other page. Only transport failures produce the error page.
 */
export function createNomadnetHandler(client: NomadnetClient) {
  return async function handleRequest(request: Request): Promise<Response> {
    console.log(`nomadnet: fetching ${request.url}`)

    try {
      const target = parseNomadnetUrl(new URL(request.url))

      /*
       * Files are fetched as Resources that Python splits above ~1 MiB, and
       * reticulum-js does not reassemble multi-segment RESPONSE resources -
       * the request would simply fail to decode. Say so plainly rather than
       * letting the user wait for an obscure failure.
       */
      if (isFilePath(target.path)) {
        throw new Error('Downloading files from NomadNet nodes is not supported yet')
      }

      const source = await client.fetch(target)
      const blocks = parseMicron(source)
      const fragment = renderBlocks(blocks, { destHashHex: target.destHashHex })

      return new Response(micronPage(fragment, blocks, target.path), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    } catch (error) {
      console.error('nomadnet: request failed:', error)

      return errorResponse(request.url, error as Error, {
        what: 'NomadNet page',
        hint: 'Make sure the node is reachable on the Reticulum network.'
      })
    }
  }
}
