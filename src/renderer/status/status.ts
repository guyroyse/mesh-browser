class StatusController {
  private statusIcon: HTMLElement
  private statusText: HTMLElement

  constructor() {
    this.statusIcon = document.getElementById('status-icon') as HTMLElement
    this.statusText = document.getElementById('status-text') as HTMLElement

    this.setupEventListeners()
  }

  /*
   * Every state comes from navigation-update alone. The url-changed channel is
   * deliberately not used here: it is sent just before a navigation-update, so
   * anything it rendered would immediately be overwritten by that message.
   */
  setupEventListeners() {
    window.browserAPI.onNavigationUpdate((data) => {
      if (data.error) {
        this.setError(data.error)
      } else if (data.isLoading) {
        this.setLoading(data.url ? `Loading ${this.getDisplayUrl(data.url)}...` : 'Loading...')
      } else {
        this.setReady()
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
      const parsed = new URL(url)

      /* about: has no host worth showing - "about:blank" is the whole name */
      return parsed.protocol === 'about:' ? url : parsed.hostname || url
    } catch {
      return url
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new StatusController()
})
