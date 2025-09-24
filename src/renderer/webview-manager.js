export class WebViewManager extends EventTarget {
  constructor() {
    super()
    this.canGoBack = false
    this.canGoForward = false
    this.isLoading = false

    this.setupEventListeners()
  }

  setupEventListeners() {
    // Listen for URL changes from main process
    window.browserAPI.onUrlChanged(url => {
      this.dispatchEvent(new CustomEvent('url-changed', { detail: { url } }))
    })

    // Listen for navigation state updates from main process
    window.browserAPI.onNavigationUpdate(data => {
      this.canGoBack = data.canGoBack
      this.canGoForward = data.canGoForward
      this.isLoading = data.isLoading

      this.dispatchEvent(new CustomEvent('nav-state-changed', {
        detail: { canGoBack: this.canGoBack, canGoForward: this.canGoForward }
      }))

      if (data.isLoading) {
        this.dispatchEvent(new CustomEvent('loading'))
      } else if (data.error) {
        this.dispatchEvent(new CustomEvent('error', { detail: { message: data.error } }))
      } else {
        this.dispatchEvent(new CustomEvent('ready'))
      }
    })
  }

  async navigate(url) {
    await window.browserAPI.navigate(url)
  }

  async goBack() {
    await window.browserAPI.goBack()
  }

  async goForward() {
    await window.browserAPI.goForward()
  }

  async refresh() {
    await window.browserAPI.refresh()
  }

  async updateNavigationState() {
    this.canGoBack = await window.browserAPI.canGoBack()
    this.canGoForward = await window.browserAPI.canGoForward()
  }
}
