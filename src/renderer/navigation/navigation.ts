class NavigationController {
  private backButton: HTMLButtonElement
  private forwardButton: HTMLButtonElement
  private refreshButton: HTMLButtonElement
  private addressBar: HTMLInputElement
  private urlForm: HTMLFormElement

  constructor() {
    this.backButton = document.getElementById('back-button') as HTMLButtonElement
    this.forwardButton = document.getElementById('forward-button') as HTMLButtonElement
    this.refreshButton = document.getElementById('refresh-button') as HTMLButtonElement
    this.addressBar = document.getElementById('address-bar') as HTMLInputElement
    this.urlForm = document.getElementById('url-form') as HTMLFormElement

    this.setupEventListeners()
    this.updateNavigationState()
  }

  setupEventListeners() {
    this.backButton.addEventListener('click', () => {
      window.browserAPI.goBack()
    })

    this.forwardButton.addEventListener('click', () => {
      window.browserAPI.goForward()
    })

    this.refreshButton.addEventListener('click', () => {
      window.browserAPI.refresh()
    })

    this.urlForm.addEventListener('submit', event => {
      event.preventDefault()
      const url = this.addressBar.value.trim()
      if (url) {
        this.navigate(url)
      }
    })

    window.browserAPI.onUrlChanged((url: string) => {
      this.addressBar.value = url
    })

    window.browserAPI.onNavigationUpdate((data: { canGoBack: boolean; canGoForward: boolean }) => {
      this.backButton.disabled = !data.canGoBack
      this.forwardButton.disabled = !data.canGoForward
    })
  }

  async navigate(url: string) {
    if (!url.includes('://')) {
      if (!url.startsWith('about:')) {
        url = `rweb://${url}`
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

document.addEventListener('DOMContentLoaded', () => {
  new NavigationController()
})
