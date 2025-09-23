import { NavigationHistory } from './navigation-history.js'
import { Status } from './status.js'

document.addEventListener('DOMContentLoaded', () => {
  const backButton = document.querySelector('#back-button')
  const forwardButton = document.querySelector('#forward-button')
  const refreshButton = document.querySelector('#refresh-button')
  const addressForm = document.querySelector('form')
  const addressInput = document.querySelector('form input')
  const browserView = document.querySelector('webview')

  const navigationHistory = new NavigationHistory()
  const status = new Status()

  console.log('Webview element:', browserView)
  console.log('Navigation history:', navigationHistory)
  console.log('Status:', status)

  browserView.addEventListener('dom-ready', () => {
    console.log('Webview is ready')
  })

  status.setReady()

  // Event listeners
  backButton.addEventListener('click', () => {
    const url = navigationHistory.goBack()
    if (url) loadUrl(url)
  })

  forwardButton.addEventListener('click', () => {
    const url = navigationHistory.goForward()
    if (url) loadUrl(url)
  })

  refreshButton.addEventListener('click', () => {
    const currentUrl = addressInput.value.trim()
    if (currentUrl) loadUrl(currentUrl)
  })

  addressForm.addEventListener('submit', event => {
    event.preventDefault()
    const url = addressInput.value.trim()
    if (url) navigate(url)
  })

  browserView.addEventListener('will-navigate', event => {
    addressInput.value = event.url
    status.setLoading(`Loading ${event.url}`)
  })

  browserView.addEventListener('did-navigate', _event => {
    status.setReady()
  })

  browserView.addEventListener('did-fail-load', event => {
    console.log('Failed to load:', event.errorDescription, event.errorCode)
    status.setError(`Error: ${event.errorDescription}`)
  })

  browserView.addEventListener('did-start-loading', () => {
    console.log('Started loading')
    status.setLoading()
  })

  browserView.addEventListener('did-stop-loading', () => {
    console.log('Stopped loading')
    status.setReady()
  })

  browserView.addEventListener('new-window', event => {
    event.preventDefault()
    navigate(event.url)
  })

  function navigate(url) {
    navigationHistory.add(url)
    loadUrl(url)
  }

  function loadUrl(url) {
    console.log('loadUrl called with:', url)
    console.log('Current webview src before:', browserView.src)
    status.setLoading(`Loading ${url}...`)
    addressInput.value = url
    browserView.src = url
    console.log('Set browserView.src to:', url)
    console.log('Current webview src after:', browserView.src)
    enabledDisableNavigation()
  }

  function enabledDisableNavigation() {
    backButton.disabled = !navigationHistory.canGoBack || status.isLoading
    forwardButton.disabled = !navigationHistory.canGoForward || status.isLoading
  }
})
