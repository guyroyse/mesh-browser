export class BrowserNavigation extends EventTarget {
  constructor() {
    super()
    this.backButton = document.querySelector('#back-button')
    this.forwardButton = document.querySelector('#forward-button')
    this.refreshButton = document.querySelector('#refresh-button')
    this.addressForm = document.querySelector('form')
    this.addressInput = document.querySelector('form input')

    this.setupEventListeners()
  }

  setupEventListeners() {
    this.backButton.addEventListener('click', () => this.dispatchEvent(new CustomEvent('back')))
    this.forwardButton.addEventListener('click', () => this.dispatchEvent(new CustomEvent('forward')))
    this.refreshButton.addEventListener('click', () => this.dispatchEvent(new CustomEvent('refresh')))
    this.addressForm.addEventListener('submit', event => {
      event.preventDefault()
      const url = this.addressInput.value.trim()
      if (url) this.dispatchEvent(new CustomEvent('navigate', { detail: { url } }))
    })
  }

  updateUrl(url) {
    this.addressInput.value = url
  }

  updateNavigationState(canGoBack, canGoForward, isLoading) {
    this.backButton.disabled = !canGoBack || isLoading
    this.forwardButton.disabled = !canGoForward || isLoading
  }
}
