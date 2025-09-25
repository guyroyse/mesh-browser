class StatusController {
  constructor() {
    this.setupElements()
    this.setupEventListeners()
  }

  setupElements() {
    this.statusIcon = document.getElementById('status-icon')
    this.statusText = document.getElementById('status-text')
  }

  setupEventListeners() {
    // Listen for navigation updates from main process
    window.browserAPI.onNavigationUpdate(data => {
      if (data.isLoading) {
        this.setLoading('Loading...')
      } else if (data.error) {
        this.setError(data.error)
      } else {
        this.setReady()
      }
    })

    // Listen for URL changes
    window.browserAPI.onUrlChanged(url => {
      if (url) {
        this.setLoading(`Loading ${this.getDisplayUrl(url)}...`)
      }
    })
  }

  setReady(message = 'Ready') {
    this.statusIcon.className = 'fas fa-circle ready'
    this.statusText.textContent = message
  }

  setLoading(message = 'Loading...') {
    this.statusIcon.className = 'fas fa-circle loading'
    this.statusText.textContent = message
  }

  setError(message = 'Error') {
    this.statusIcon.className = 'fas fa-circle error'
    this.statusText.textContent = message
  }

  getDisplayUrl(url) {
    try {
      const urlObj = new URL(url)
      if (urlObj.protocol === 'reticulum:') {
        // Show just the hash portion for reticulum URLs
        return urlObj.hostname || urlObj.pathname
      } else if (urlObj.protocol === 'about:') {
        return url
      } else {
        return urlObj.hostname || url
      }
    } catch {
      return url
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new StatusController()
})