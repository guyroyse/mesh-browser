const { spawn } = require('child_process')
const { ProcessUtils } = require('./utils')

class ProcessStarter {
  constructor(command, args, options = {}) {
    this.command = command
    this.args = args
    this.options = { stdio: ['pipe', 'pipe', 'pipe'], ...options }
  }

  #spawnProcess() {
    return spawn(this.command, this.args, this.options)
  }

  #cleanupStartupListeners(timeout, errorHandler, dataHandler, process) {
    clearTimeout(timeout)
    process.removeListener('error', errorHandler)
    process.stdout.removeListener('data', dataHandler)
  }

  #processStartupMessage(message, onStartupComplete, resolve, cleanup) {
    if (message.type === 'startup') {
      console.log('Process system message:', message)
      cleanup()
      onStartupComplete()
      resolve()
      return true
    }
    return false
  }

  async start(onStartupComplete) {
    return new Promise((resolve, reject) => {
      const process = this.#spawnProcess()

      const startupTimeout = setTimeout(() => {
        this.#cleanupStartupListeners(startupTimeout, onStartupError, onStartupData, process)
        reject(new Error('Process startup timeout'))
      }, 5000)

      const onStartupError = error => {
        this.#cleanupStartupListeners(startupTimeout, onStartupError, onStartupData, process)
        reject(error)
      }

      const cleanup = () => {
        this.#cleanupStartupListeners(startupTimeout, onStartupError, onStartupData, process)
      }

      const onStartupData = data => {
        const messages = ProcessUtils.parseDataToMessages(data)

        for (const message of messages) {
          if (this.#processStartupMessage(message, onStartupComplete, () => resolve(process), cleanup)) {
            return
          }
        }
      }

      // Listen for startup messages and errors
      process.on('error', onStartupError)
      process.stdout.on('data', onStartupData)
    })
  }
}

module.exports = { ProcessStarter }