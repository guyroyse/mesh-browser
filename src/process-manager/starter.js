const { spawn } = require('child_process')
const { parseDataToMessages } = require('./utils')

async function startProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawnProcess(command, args, options)

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
      resolve(process)
    }

    process.on('error', cleanupAndReject)

    process.stdout.on('data', data => {
      try {
        if (processStartupMessage(data)) cleanupAndResolve()
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
  if (messages.length === 0) return false
  if (messages.length > 1) throw new Error('Multiple messages received on startup but expected one')

  const message = messages[0]
  if (message.type !== 'startup') throw new Error(`Expected startup message, got: ${message.type}`)

  console.log('Process system message:', message)

  return true
}

function cleanup(timeout, process) {
  if (timeout) clearTimeout(timeout)
  if (process) {
    process.removeAllListeners('error')
    process.stdout.removeAllListeners('data')
  }
}

module.exports = { startProcess }
