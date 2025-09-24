export class WebViewManager extends EventTarget {
  constructor() {
    super()
    this.browserView = document.querySelector('webview')

    this.setupEventListeners()
  }

  setupEventListeners() {
    this.browserView.addEventListener('will-navigate', event => {
      this.dispatchEvent(new CustomEvent('url-changed', { detail: { url: event.url } }))
      this.dispatchEvent(new CustomEvent('loading', { detail: { message: `Loading ${event.url}...` } }))
    })

    this.browserView.addEventListener('did-navigate', event => {
      this.dispatchEvent(new CustomEvent('url-changed', { detail: { url: event.url } }))
      this.dispatchEvent(new CustomEvent('ready'))
      this.dispatchEvent(
        new CustomEvent('nav-state-changed', {
          detail: { canGoBack: this.canGoBack, canGoForward: this.canGoForward }
        })
      )
    })

    this.browserView.addEventListener('did-navigate-in-page', event => {
      this.dispatchEvent(new CustomEvent('url-changed', { detail: { url: event.url } }))
      this.dispatchEvent(
        new CustomEvent('nav-state-changed', {
          detail: { canGoBack: this.canGoBack, canGoForward: this.canGoForward }
        })
      )
    })

    this.browserView.addEventListener('did-fail-load', event => {
      this.dispatchEvent(new CustomEvent('error', { detail: { message: `Error: ${event.errorDescription}` } }))
    })

    this.browserView.addEventListener('did-start-loading', () => this.dispatchEvent(new CustomEvent('loading')))

    this.browserView.addEventListener('did-stop-loading', () => {
      this.dispatchEvent(new CustomEvent('ready'))
      this.dispatchEvent(
        new CustomEvent('nav-state-changed', {
          detail: { canGoBack: this.canGoBack, canGoForward: this.canGoForward }
        })
      )
    })

    this.browserView.addEventListener('new-window', event => {
      event.preventDefault()
      this.navigate(event.url)
    })
  }

  get canGoBack() {
    return this.browserView.canGoBack()
  }

  get canGoForward() {
    return this.browserView.canGoForward()
  }

  navigate(url) {
    this.browserView.src = url
  }

  goBack() {
    if (this.browserView.canGoBack()) this.browserView.goBack()
  }

  goForward() {
    if (this.browserView.canGoForward()) this.browserView.goForward()
  }

  refresh() {
    this.browserView.reload()
  }
}
