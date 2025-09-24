import { Status } from './status.js'
import { BrowserNavigation } from './browser-navigation.js'
import { WebViewManager } from './webview-manager.js'

document.addEventListener('DOMContentLoaded', () => {
  const status = new Status()
  const navigation = new BrowserNavigation()
  const webViewManager = new WebViewManager()

  // Wire navigation events to webview manager
  navigation.addEventListener('navigate', event => webViewManager.navigate(event.detail.url))
  navigation.addEventListener('back', () => webViewManager.goBack())
  navigation.addEventListener('forward', () => webViewManager.goForward())
  navigation.addEventListener('refresh', () => webViewManager.refresh())

  // Wire webview events to navigation UI
  webViewManager.addEventListener('url-changed', event => navigation.updateUrl(event.detail.url))
  webViewManager.addEventListener('nav-state-changed', event => {
    const { canGoBack, canGoForward } = event.detail
    navigation.updateNavigationState(canGoBack, canGoForward, status.isLoading)
  })

  // Wire webview events to status
  webViewManager.addEventListener('loading', event => {
    status.setLoading(event.detail?.message ?? 'Loading...')
    updateNavigationState()
  })

  webViewManager.addEventListener('ready', () => {
    status.setReady()
    updateNavigationState()
  })

  webViewManager.addEventListener('error', event => {
    status.setError(event.detail.message)
    updateNavigationState()
  })

  // Helpers
  function updateNavigationState() {
    navigation.updateNavigationState(webViewManager.canGoBack, webViewManager.canGoForward, status.isLoading)
  }
})
