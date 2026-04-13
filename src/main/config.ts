import path from 'path'

import { app } from 'electron'

export enum Environment {
  DEV = 'DEV',
  PROD = 'PROD'
}

/* Current environment */
export const environment = fetchEnvironment()
export const isProd = environment === Environment.PROD
export const isDev = environment === Environment.DEV

/* Electron paths for loading the app */
export const rendererBaseUrl = fetchRendererBaseUrl()
export const navigationUrl = fetchNavigationUrl()
export const statusUrl = fetchStatusUrl()
export const preloadPath = fetchPreloadPath()
export const pythonPath = fetchPythonPath()

/* Determine the current environment */
function fetchEnvironment(): Environment {
  if (app.isPackaged) return Environment.PROD
  if (process.env.ELECTRON_RENDERER_URL) return Environment.DEV
  throw new Error('Unable to determine environment: app is not packaged and ELECTRON_RENDERER_URL is not defined')
}

/* Get renderer URL based on environment */
function fetchRendererBaseUrl(): string {
  const isDev = environment === Environment.DEV
  const hasRendererUrl = !!process.env.ELECTRON_RENDERER_URL

  if (isDev && !hasRendererUrl) throw new Error('ELECTRON_RENDERER_URL is not defined in DEV environment')

  const devUrl = process.env.ELECTRON_RENDERER_URL as string
  const prodUrl = new URL('../renderer', import.meta.url).href

  return isDev ? devUrl : prodUrl
}

/* Get navigation view URL */
function fetchNavigationUrl(): string {
  return `${rendererBaseUrl}/navigation/index.html`
}

/* Get status view URL */
function fetchStatusUrl(): string {
  return `${rendererBaseUrl}/status/index.html`
}

/* Get preload script path */
function fetchPreloadPath(): string {
  return new URL('../preload/preload.js', import.meta.url).pathname
}

/* Get Python backend script path */
function fetchPythonPath(): string {
  const devPath = path.join(app.getAppPath(), 'src', 'python', 'main.py')
  const prodPath = path.join(process.resourcesPath, 'python', 'main.py')

  return isDev ? devPath : prodPath
}
