const { ulid } = require('ulid')
const { parseDataToMessages } = require('./utils')
const { PendingRequests } = require('./pending-requests')

class MessageHandler {
  #pendingRequests = new PendingRequests()
  #process = null

  attachTo(process) {
    process.stdout.on('data', data => this.#onStdOut(data))
    process.stderr.on('data', data => this.#onStdErr(data))
    process.on('close', code => this.#onProcessExit(code))
    process.on('error', error => this.#onProcessError(error))

    this.#process = process
  }

  detachFrom() {
    if (this.#process) {
      this.#process.removeAllListeners('data')
      this.#process.removeAllListeners('close')
      this.#process.removeAllListeners('error')
      this.#process.stdout.removeAllListeners('data')
      this.#process.stderr.removeAllListeners('data')
      this.#process = null
    }
  }

  async sendCommand(command, data = {}) {
    if (!this.#process) throw new Error('Process not ready')

    const requestId = ulid()

    return new Promise((resolve, reject) => {
      this.#pendingRequests.add(requestId, resolve, reject)
      this.#sendMessage(requestId, command, data)
    })
  }

  #sendMessage(requestId, command, data) {
    const message = { id: requestId, command: command, ...data }
    const jsonMessage = `${JSON.stringify(message)}\n`

    console.log('Sending message:', jsonMessage.trim())

    this.#process.stdin.write(jsonMessage)
  }

  #onStdOut(data) {
    console.log('Process stdout:', data.toString())

    const messages = parseDataToMessages(data)
    for (const message of messages) this.#processMessage(message)
  }

  #onStdErr(data) {
    console.error('Process stderr:', data.toString())
  }

  #onProcessExit(code) {
    console.log(`Process exited with code ${code}`)
    this.#pendingRequests.rejectAll(new Error('Process terminated'))
  }

  #onProcessError(error) {
    console.error('Process error:', error)
  }

  #processMessage(message) {
    const requestId = message.id
    if (message.success) {
      this.#pendingRequests.resolve(requestId, message.data)
    } else {
      this.#pendingRequests.reject(requestId, new Error(message.error ?? 'Unknown process error'))
    }
  }
}

module.exports = { MessageHandler }
