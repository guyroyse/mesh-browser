/**
 * Where the app's own files live.
 */

import { fileURLToPath } from 'url'
import { app } from 'electron'

import dedent from 'dedent'

/**
 * The base URL the renderer's HTML is served from.
 *
 * Packaged builds load the bundled output from disk; development loads from
 * the Vite dev server, which sets ELECTRON_RENDERER_URL.
 */
function rendererBaseUrl(): string {
  if (app.isPackaged) return new URL('../renderer', import.meta.url).href

  const devUrl = process.env.ELECTRON_RENDERER_URL

  if (devUrl) return devUrl

  throw new Error(dedent`
    App is not packaged and ELECTRON_RENDERER_URL is not defined.
    The main process must be launched by electron-vite in development.`)
}

/** Cache the base URL so that it is not recomputed every time a path is needed. */
const rendererBase = rendererBaseUrl()

/**
 * The URLs used by the main process to load the renderer's HTML.
 */
export const navigationUrl = `${rendererBase}/navigation/index.html`
export const statusUrl = `${rendererBase}/status/index.html`
export const preloadPath = fileURLToPath(new URL('../preload/preload.js', import.meta.url))
