class NavigationController {
  constructor() {
    this.setupElements()
    this.setupEventListeners()
    this.updateNavigationState()
  }

  setupElements() {
    this.backButton = document.getElementById('back-button')
    this.forwardButton = document.getElementById('forward-button')
    this.refreshButton = document.getElementById('refresh-button')
    this.addressBar = document.getElementById('address-bar')
    this.urlForm = document.getElementById('url-form')
  }

  setupEventListeners() {
    // Navigation buttons
    this.backButton.addEventListener('click', () => {
      window.browserAPI.goBack()
    })

    this.forwardButton.addEventListener('click', () => {
      window.browserAPI.goForward()
    })

    this.refreshButton.addEventListener('click', () => {
      window.browserAPI.refresh()
    })

    // URL form submission
    this.urlForm.addEventListener('submit', (event) => {
      event.preventDefault()
      const url = this.addressBar.value.trim()
      if (url) {
        this.navigate(url)
      }
    })

    // Listen for URL changes from main process
    window.browserAPI.onUrlChanged(url => {
      this.addressBar.value = url
    })

    // Listen for navigation state updates
    window.browserAPI.onNavigationUpdate(data => {
      this.backButton.disabled = !data.canGoBack
      this.forwardButton.disabled = !data.canGoForward
    })
  }

  async navigate(url) {
    // Add protocol if none specified
    if (!url.includes('://')) {
      if (url.startsWith('about:')) {
        // Keep about: URLs as-is
      } else {
        // Default to reticulum protocol
        url = `reticulum://${url}`
      }
    }

    await window.browserAPI.navigate(url)
  }

  async updateNavigationState() {
    const canGoBack = await window.browserAPI.canGoBack()
    const canGoForward = await window.browserAPI.canGoForward()

    this.backButton.disabled = !canGoBack
    this.forwardButton.disabled = !canGoForward
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new NavigationController()
})