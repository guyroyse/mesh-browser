const { spawn } = require('child_process')
const { parseDataToMessages } = require('./utils')

async function startProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawnProcess(command, args, options)
    let httpPort = null

    const timeout = setTimeout(() => {
      cleanup(timeout, process)
      reject(new Error('Process startup timeout'))
    }, 5000)

    const cleanupAndReject = error => {
      cleanup(timeout, process)
      reject(error)
    }

    const cleanupAndResolve = () => {
      cleanup(timeout, process)
      resolve({ process, httpPort })
    }

    process.on('error', cleanupAndReject)

    process.stdout.on('data', data => {
      try {
        const result = processStartupMessage(data)
        if (result.httpPort) httpPort = result.httpPort
        if (result.ready) cleanupAndResolve()
      } catch (error) {
        cleanupAndReject(error)
      }
    })
  })
}

function spawnProcess(command, args, options) {
  const processOptions = { stdio: ['pipe', 'pipe', 'pipe'], ...options }
  return spawn(command, args, processOptions)
}

function processStartupMessage(data) {
  console.log('Process stdout (startup):', data.toString())
  const messages = parseDataToMessages(data)
  if (messages.length === 0) return { ready: false, httpPort: null }

  let httpPort = null
  let ready = false

  // Process all messages during startup
  for (const message of messages) {
    console.log('Process system message:', message)

    // Capture HTTP port from HTTP_STARTUP message
    if (message.type === 'HTTP_STARTUP' && message.port) {
      httpPort = message.port
    }

    // Consider process ready when we receive the 'startup' message
    if (message.type === 'startup') {
      ready = true
    }
  }

  return { ready, httpPort }
}

function cleanup(timeout, process) {
  if (timeout) clearTimeout(timeout)
  if (process) {
    process.removeAllListeners('error')
    process.stdout.removeAllListeners('data')
  }
}

module.exports = { startProcess }
