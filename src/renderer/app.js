// MeshBrowser renderer script - System Handler Test

document.addEventListener('DOMContentLoaded', async () => {
  const pingBtn = document.getElementById('pingBtn')
  const versionBtn = document.getElementById('versionBtn')
  const resultDiv = document.getElementById('result')

  // Test ping command
  pingBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = '<p style="color: blue;">🏓 Testing ping...</p>'

    try {
      const data = await window.meshBrowserAPI.ping()

      resultDiv.innerHTML = `
        <h3>Ping Test Results:</h3>
        <p><strong>Pong:</strong> ${data.pong ? '✅ Received' : '❌ Not received'}</p>
        <p style="color: green;"><strong>✅ Python Backend:</strong> Ping successful!</p>
      `
    } catch (error) {
      resultDiv.innerHTML = `<p style="color: red;">❌ Ping Error: ${error.message}</p>`
    }
  })

  // Test version command
  versionBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = '<p style="color: blue;">📋 Getting version info...</p>'

    try {
      const data = await window.meshBrowserAPI.version()

      resultDiv.innerHTML = `
        <h3>Version Test Results:</h3>
        <p><strong>Python Version:</strong> ${data.python_version || 'Not available'}</p>
        <p><strong>Working Directory:</strong> ${data.working_directory || 'Not available'}</p>
        <p><strong>Timestamp:</strong> ${data.timestamp || 'Not available'}</p>
        <p style="color: green;"><strong>✅ Python Backend:</strong> Version info retrieved!</p>
      `
    } catch (error) {
      resultDiv.innerHTML = `<p style="color: red;">❌ Version Error: ${error.message}</p>`
    }
  })

  // Check if API is available
  if (window.meshBrowserAPI) {
    resultDiv.innerHTML =
      '<p style="color: green;">✓ meshBrowserAPI is available! Click buttons to test system commands.</p>'
  } else {
    resultDiv.innerHTML = '<p style="color: red;">✗ meshBrowserAPI is not available. Check preload script.</p>'
  }
})
