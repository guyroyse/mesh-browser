// MeshBrowser renderer script - Browser Navigation

document.addEventListener('DOMContentLoaded', async () => {
  const addressInput = document.getElementById('addressInput')
  const goBtn = document.getElementById('goBtn')
  const backBtn = document.getElementById('backBtn')
  const forwardBtn = document.getElementById('forwardBtn')
  const contentDisplay = document.getElementById('contentDisplay')
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
      loadContent(url)
      updateNavigationButtons()
    }
  })

  forwardBtn.addEventListener('click', () => {
    if (historyIndex < history.length - 1) {
      historyIndex++
      const url = history[historyIndex]
      addressInput.value = url
      loadContent(url)
      updateNavigationButtons()
    }
  })

  // Main navigation function
  async function navigate(url) {
    // Add to history (remove any forward history if we're not at the end)
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1)
    }
    history.push(url)
    historyIndex = history.length - 1

    addressInput.value = url
    updateNavigationButtons()
    await loadContent(url)
  }

  // Load content based on URL scheme
  async function loadContent(url) {
    statusText.textContent = 'Loading...'

    try {
      if (url.startsWith('about:')) {
        // Show about pages in contentDisplay, hide webview
        browserView.style.display = 'none'
        contentDisplay.style.display = 'block'
        contentDisplay.innerHTML = '<div class="loading">Loading...</div>'

        await loadAboutPage(url)
      } else if (url.startsWith('reticulum://')) {
        // Show webview, hide contentDisplay
        contentDisplay.style.display = 'none'
        browserView.style.display = 'block'

        await loadReticulumPage(url)
      } else {
        throw new Error('Unsupported URL scheme. Use about: or reticulum://')
      }
      statusText.textContent = 'Ready'
    } catch (error) {
      displayError(error.message)
      statusText.textContent = 'Error'
    }
  }

  // Load about: pages
  async function loadAboutPage(url) {
    const aboutType = url.substring(6) // Remove 'about:'

    switch (aboutType) {
      case 'system':
        await loadSystemPage()
        break
      case 'reticulum':
        await loadReticulumStatusPage()
        break
      default:
        throw new Error(`Unknown about page: ${aboutType}`)
    }
  }

  // Load system information page
  async function loadSystemPage() {
    try {
      const data = await window.meshBrowserAPI.version()

      contentDisplay.innerHTML = `
        <div class="about-page">
          <h2>System Information</h2>
          <table>
            <tr>
              <th>Python Version</th>
              <td>${data.python_version || 'Not available'}</td>
            </tr>
            <tr>
              <th>Working Directory</th>
              <td>${data.working_directory || 'Not available'}</td>
            </tr>
            <tr>
              <th>Timestamp</th>
              <td>${data.timestamp || 'Not available'}</td>
            </tr>
            <tr>
              <th>Backend Status</th>
              <td><span class="status-indicator connected"></span>Connected</td>
            </tr>
          </table>
          <p><strong>Backend Communication:</strong> ✅ Working correctly</p>
        </div>
      `
    } catch (error) {
      throw new Error(`Failed to load system information: ${error.message}`)
    }
  }

  // Load Reticulum status page
  async function loadReticulumStatusPage() {
    try {
      const data = await window.meshBrowserAPI.reticulumStatus()

      const statusIndicator = data.initialized ? 'connected' : 'disconnected'
      const statusText = data.initialized ? 'Initialized' : 'Not initialized'

      contentDisplay.innerHTML = `
        <div class="about-page">
          <h2>Reticulum Network Status</h2>
          <table>
            <tr>
              <th>Network Status</th>
              <td><span class="status-indicator ${statusIndicator}"></span>${statusText}</td>
            </tr>
            <tr>
              <th>Identity Hash</th>
              <td>${data.identity_hash || 'Not available'}</td>
            </tr>
            <tr>
              <th>Active Interfaces</th>
              <td>${data.interfaces ? data.interfaces.length : 0}</td>
            </tr>
          </table>
          ${data.interfaces && data.interfaces.length > 0 ? `
            <h3>Network Interfaces</h3>
            <table>
              <thead>
                <tr>
                  <th>Interface</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${data.interfaces.map(iface => `
                  <tr>
                    <td>${iface.name || 'Unknown'}</td>
                    <td>${iface.type || 'Unknown'}</td>
                    <td><span class="status-indicator ${iface.status === 'active' ? 'connected' : 'disconnected'}"></span>${iface.status || 'Unknown'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p>No network interfaces available.</p>'}
        </div>
      `
    } catch (error) {
      throw new Error(`Failed to load Reticulum status: ${error.message}`)
    }
  }

  // Load content from Reticulum network using webview
  async function loadReticulumPage(url) {
    try {
      statusText.textContent = 'Loading from Reticulum network...'

      // Load URL directly in webview - protocol handler will handle it!
      browserView.src = url

      // The webview will automatically handle:
      // - Fetching the main page via our protocol handler
      // - Loading embedded resources (images, CSS, JS) via protocol handler
      // - JavaScript execution in the loaded page
      // - Relative URL resolution

    } catch (error) {
      throw new Error(`Failed to load Reticulum page: ${error.message}`)
    }
  }

  // Display error message
  function displayError(message) {
    contentDisplay.innerHTML = `
      <div class="error-page">
        <h2>Error</h2>
        <p>${escapeHtml(message)}</p>
      </div>
    `
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
      if (e.url.startsWith('reticulum://')) {
        addressInput.value = e.url
        statusText.textContent = 'Loading from Reticulum network...'
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
      // Could update window title here if desired
      console.log('Page title updated:', e.title)
    })

    browserView.addEventListener('dom-ready', () => {
      console.log('Webview DOM ready')
    })

    // Handle new window requests (optional)
    browserView.addEventListener('new-window', (e) => {
      e.preventDefault()
      console.log('New window requested for:', e.url)

      // Navigate in same webview instead of opening new window
      if (e.url.startsWith('reticulum://')) {
        navigate(e.url)
      }
    })
  }

  // Utility function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // Note: With the webview + protocol handler approach, embedded resource processing
  // is no longer needed. The webview automatically handles:
  // - Loading images, CSS, JS via the reticulum:// protocol handler
  // - Relative URL resolution
  // - JavaScript execution in an isolated context
  // - Link navigation within the webview

  // Check if API is available
  if (!window.meshBrowserAPI) {
    displayError('meshBrowserAPI is not available. Check preload script.')
    statusText.textContent = 'API Error'
  }
})
