const { ulid } = require('ulid')
const { ProcessUtils } = require('./utils')

class MessageHandler {
  #pendingRequests = new Map()

  #processMessage(message) {
    // System messages
    if (message.type === 'startup' || message.type === 'shutdown' || message.type === 'error') {
      console.log('Process system message:', message)
      return
    }

    // Response to a specific request
    const requestId = message.id
    if (this.#pendingRequests.has(requestId)) {
      const { resolve, reject } = this.#pendingRequests.get(requestId)
      this.#pendingRequests.delete(requestId)

      if (message.success) {
        resolve(message.data)
      } else {
        reject(new Error(message.error || 'Unknown process error'))
      }
    }
  }

  #onStdOut(data) {
    console.log('Process stdout:', data.toString())

    const messages = ProcessUtils.parseDataToMessages(data)
    for (const message of messages) this.#processMessage(message)
  }

  #onStdErr(data) {
    console.error('Process stderr:', data.toString())
  }

  #onProcessExit(code) {
    console.log(`Process exited with code ${code}`)

    // Reject all pending requests and clear them
    for (const [_id, { reject }] of this.#pendingRequests) reject(new Error('Process terminated'))
    this.#pendingRequests.clear()
  }

  #onProcessError(error) {
    console.error('Process error:', error)
  }

  attachTo(process) {
    this.process = process
    process.stdout.on('data', data => this.#onStdOut(data))
    process.stderr.on('data', data => this.#onStdErr(data))
    process.on('close', code => this.#onProcessExit(code))
    process.on('error', error => this.#onProcessError(error))
  }

  async sendCommand(command, data = {}) {
    if (!this.process) throw new Error('Process not ready')

    const requestId = ulid()

    return new Promise((resolve, reject) => {
      // Store the promise resolvers
      this.#pendingRequests.set(requestId, { resolve, reject })

      // Set timeout for request
      setTimeout(() => {
        if (this.#pendingRequests.has(requestId)) {
          this.#pendingRequests.delete(requestId)
          reject(new Error('Request timeout'))
        }
      }, 10000)

      // Send command to process
      const message = {
        id: requestId,
        command: command,
        ...data
      }

      const jsonMessage = JSON.stringify(message) + '\n'
      this.process.stdin.write(jsonMessage)
    })
  }
}

module.exports = { MessageHandler }