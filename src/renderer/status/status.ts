class StatusController {
  private statusIcon: HTMLElement
  private statusText: HTMLElement

  constructor() {
    this.statusIcon = document.getElementById('status-icon') as HTMLElement
    this.statusText = document.getElementById('status-text') as HTMLElement

    this.setupEventListeners()
  }

  setupEventListeners() {
    window.browserAPI.onNavigationUpdate((data: { isLoading: boolean; error?: string }) => {
      if (data.isLoading) {
        this.setLoading('Loading...')
      } else if (data.error) {
        this.setError(data.error)
      } else {
        this.setReady()
      }
    })

    window.browserAPI.onUrlChanged((url: string) => {
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

  getDisplayUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      if (urlObj.protocol === 'reticulum:') {
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

document.addEventListener('DOMContentLoaded', () => {
  new StatusController()
})
