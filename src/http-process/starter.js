const { spawn } = require('child_process')

// Lifecycle frame types we care about during startup
const STARTUP_FRAMES = ['STARTUP', 'HTTP_STARTUP', 'ERROR']

async function startProcess(commands, args, options = {}) {
  let lastError = null

  // Try each command until one works
  for (const command of commands) {
    try {
      const result = await trySpawnProcess(command, args, options)
      console.log(`Successfully started process with command: ${command}`)
      return result
    } catch (error) {
      lastError = error
      console.log(`Failed to start with '${command}': ${error.message}`)
      // Continue to next command
    }
  }

  // All commands failed
  throw new Error(
    `Failed to start process with any command. Tried: ${commands.join(', ')}. ` +
    `Last error: ${lastError?.message}`
  )
}

function trySpawnProcess(command, args, options) {
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
  console.log(data.toString().trim())
  const messages = parseStartupMessages(data.toString())
  if (messages.length === 0) return { ready: false, httpPort: null }

  let httpPort = null
  let ready = false

  // Process all messages during startup
  for (const message of messages) {
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

function parseStartupMessages(data) {
  return data
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && hasValidFrame(line))
    .map(line => {
      const { frame, message } = parseFramedMessage(line)
      const parsedMessage = tryParseJSON(message)
      if (parsedMessage) {
        parsedMessage._frame = frame
      }
      return parsedMessage
    })
    .filter(msg => msg !== null)
}

function hasValidFrame(line) {
  return STARTUP_FRAMES.some(frame => line.startsWith(`${frame}: `))
}

function parseFramedMessage(line) {
  for (const frame of STARTUP_FRAMES) {
    const prefix = `${frame}: `
    if (line.startsWith(prefix)) {
      return {
        frame,
        message: line.substring(prefix.length)
      }
    }
  }
  throw new Error(`No valid frame found in line: ${line}`)
}

function tryParseJSON(line) {
  try {
    return JSON.parse(line)
  } catch (e) {
    console.error('Failed to parse framed message JSON:', line, e)
  }
  return null
}

function cleanup(timeout, process) {
  if (timeout) clearTimeout(timeout)
  if (process) {
    process.removeAllListeners('error')
    process.stdout.removeAllListeners('data')
  }
}

module.exports = { startProcess }
