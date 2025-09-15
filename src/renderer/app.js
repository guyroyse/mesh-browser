// MeshBrowser renderer script with IPC testing

document.addEventListener('DOMContentLoaded', async () => {
  const testBtn = document.getElementById('testBtn')
  const resultDiv = document.getElementById('result')

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

  // Check if API is available
  if (window.meshBrowserAPI) {
    resultDiv.innerHTML =
      '<p style="color: green;">✓ meshBrowserAPI is available! Click the button to test IPC communication.</p>'
  } else {
    resultDiv.innerHTML = '<p style="color: red;">✗ meshBrowserAPI is not available. Check preload script.</p>'
  }
})
