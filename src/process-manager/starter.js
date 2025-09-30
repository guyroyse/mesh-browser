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

    // Capture HTTP port from HTTP_STARTUP message (check _frame)
    if (message._frame === 'HTTP_STARTUP' && message.port) {
      httpPort = message.port
      console.log(`Startup: Captured HTTP port ${httpPort}`)
    }

    // Consider process ready when we receive the 'startup' message (check both _frame and type)
    if (message._frame === 'STARTUP' || message.type === 'startup') {
      ready = true
      console.log('Startup: Backend ready signal received')
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
