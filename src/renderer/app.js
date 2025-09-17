// MeshBrowser renderer script with IPC testing

document.addEventListener('DOMContentLoaded', async () => {
  const testBtn = document.getElementById('testBtn')
  const resultDiv = document.getElementById('result')
  const fetchBtn = document.getElementById('fetchBtn')
  const destHashInput = document.getElementById('destHash')
  const fetchResultDiv = document.getElementById('fetchResult')
  const contentBox = document.getElementById('contentBox')

  // Test IPC on button click
  testBtn.addEventListener('click', async () => {
    try {
      // Test IPC communication
      const response = await window.meshBrowserAPI.getTestMessage()

      resultDiv.innerHTML = `
        <h3>IPC Test Results:</h3>
        <p><strong>Message:</strong> ${response.message}</p>
        <p><strong>Timestamp:</strong> ${response.timestamp}</p>
        ${response.python_version ? `<p><strong>Python Version:</strong> ${response.python_version}</p>` : ''}
        ${response.working_directory ? `<p><strong>Python Working Dir:</strong> ${response.working_directory}</p>` : ''}
        ${response.fallback ? '<p style="color: orange;"><strong>⚠️ Fallback:</strong> Using Node.js response (Python unavailable)</p>' : '<p style="color: green;"><strong>✅ Success:</strong> Response from Python backend</p>'}
      `
    } catch (error) {
      resultDiv.innerHTML = `<p style="color: red;">IPC Error: ${error.message}</p>`
    }
  })

  // Fetch Reticulum content on button click
  fetchBtn.addEventListener('click', async () => {
    const url = destHashInput.value.trim()

    if (!url) {
      fetchResultDiv.innerHTML = '<p style="color: red;">Please enter a destination hash and path</p>'
      return
    }

    fetchResultDiv.innerHTML = '<p style="color: blue;">🔍 Fetching content from Reticulum network...</p>'
    contentBox.value = 'Fetching...'

    try {
      const response = await window.meshBrowserAPI.fetchPage(url)

      fetchResultDiv.innerHTML = `
        <h3>Fetch Results:</h3>
        <p><strong>Status:</strong> ${response.status_code}</p>
        <p><strong>Content Type:</strong> ${response.content_type}</p>
        <p><strong>Encoding:</strong> ${response.encoding}</p>
        <p style="color: green;"><strong>✅ Success:</strong> Content fetched successfully</p>
      `

      // Decode base64 content and display
      if (response.content && response.encoding === 'base64') {
        const decodedContent = atob(response.content)
        contentBox.value = decodedContent
      } else {
        contentBox.value = response.content || 'No content returned'
      }

    } catch (error) {
      fetchResultDiv.innerHTML = `<p style="color: red;">❌ Fetch Error: ${error.message}</p>`
      contentBox.value = `Error: ${error.message}`
    }
  })

  // Check if API is available
  if (window.meshBrowserAPI) {
    resultDiv.innerHTML =
      '<p style="color: green;">✓ meshBrowserAPI is available! Click the button to test IPC communication.</p>'
  } else {
    resultDiv.innerHTML = '<p style="color: red;">✗ meshBrowserAPI is not available. Check preload script.</p>'
  }
})
