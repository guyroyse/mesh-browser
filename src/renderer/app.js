// MeshBrowser renderer script - Simplified with Protocol Handlers

document.addEventListener('DOMContentLoaded', () => {
  const addressInput = document.getElementById('addressInput')
  const goBtn = document.getElementById('goBtn')
  const backBtn = document.getElementById('backBtn')
  const forwardBtn = document.getElementById('forwardBtn')
  const browserView = document.getElementById('browserView')
  const statusText = document.getElementById('statusText')

  // Navigation history
  let history = []
  let historyIndex = -1

  // Initialize with about:system
  navigate('about:system')

  // Setup webview event handlers
  setupWebviewHandlers()

  // Event listeners
  goBtn.addEventListener('click', () => {
    const url = addressInput.value.trim()
    if (url) {
      navigate(url)
    }
  })

  addressInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const url = addressInput.value.trim()
      if (url) {
        navigate(url)
      }
    }
  })

  backBtn.addEventListener('click', () => {
    if (historyIndex > 0) {
      historyIndex--
      const url = history[historyIndex]
      addressInput.value = url
      loadUrl(url)
      updateNavigationButtons()
    }
  })

  forwardBtn.addEventListener('click', () => {
    if (historyIndex < history.length - 1) {
      historyIndex++
      const url = history[historyIndex]
      addressInput.value = url
      loadUrl(url)
      updateNavigationButtons()
    }
  })

  // Main navigation function
  function navigate(url) {
    // Add to history (remove any forward history if we're not at the end)
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1)
    }
    history.push(url)
    historyIndex = history.length - 1

    addressInput.value = url
    updateNavigationButtons()
    loadUrl(url)
  }

  // Load URL in webview - protocol handlers handle everything!
  function loadUrl(url) {
    statusText.textContent = 'Loading...'

    // Protocol handlers handle both about: and reticulum:// URLs
    browserView.src = url

    // That's it! The protocol handlers do all the work:
    // - about:system → About protocol handler generates system page
    // - about:reticulum → About protocol handler generates network status
    // - reticulum://hash/path → Reticulum protocol handler fetches content
    // - All embedded resources load automatically via protocol handlers
  }

  // Update navigation button states
  function updateNavigationButtons() {
    backBtn.disabled = historyIndex <= 0
    forwardBtn.disabled = historyIndex >= history.length - 1
  }

  // Setup webview event handlers
  function setupWebviewHandlers() {
    // Handle webview navigation events
    browserView.addEventListener('will-navigate', (e) => {
      console.log('Webview will navigate to:', e.url)

      // Update address bar when navigating within webview
      if (e.url.startsWith('reticulum://') || e.url.startsWith('about:')) {
        addressInput.value = e.url
        statusText.textContent = 'Loading...'
      }
    })

    browserView.addEventListener('did-navigate', (e) => {
      console.log('Webview navigated to:', e.url)
      statusText.textContent = 'Ready'
    })

    browserView.addEventListener('did-fail-load', (e) => {
      console.error('Webview failed to load:', e.errorDescription)
      statusText.textContent = `Error: ${e.errorDescription}`
    })

    browserView.addEventListener('did-start-loading', () => {
      statusText.textContent = 'Loading...'
    })

    browserView.addEventListener('did-stop-loading', () => {
      statusText.textContent = 'Ready'
    })

    browserView.addEventListener('page-title-updated', (e) => {
      console.log('Page title updated:', e.title)
    })

    browserView.addEventListener('dom-ready', () => {
      console.log('Webview DOM ready')
    })

    // Handle new window requests - navigate in same webview
    browserView.addEventListener('new-window', (e) => {
      e.preventDefault()
      console.log('New window requested for:', e.url)

      // Navigate in same webview instead of opening new window
      if (e.url.startsWith('reticulum://') || e.url.startsWith('about:')) {
        navigate(e.url)
      }
    })
  }
})