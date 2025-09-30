const { startProcess } = require('./starter')
const { MessageHandler } = require('./message-handler')
const { stopProcess } = require('./stopper')

class ProcessManager {
  #command
  #args
  #options
  #handler
  #process = null
  #httpPort = null

  constructor(command, args, options = {}) {
    this.#command = command
    this.#args = args
    this.#options = options
    this.#handler = new MessageHandler()

    // Listen for HTTP server ready event
    this.#handler.on('HTTP_STARTUP', (data) => {
      console.log('ProcessManager: HTTP_STARTUP event received:', data)
      this.#httpPort = data.port
      console.log(`ProcessManager: HTTP server ready on port ${this.#httpPort}`)
    })
  }

  async start() {
    const { process, httpPort } = await startProcess(this.#command, this.#args, this.#options)

    if (httpPort) {
      this.#httpPort = httpPort
      console.log(`ProcessManager: HTTP server ready on port ${this.#httpPort}`)
    }

    this.#handler.attachTo(process)
    this.#process = process
  }

  async sendCommand(command, data = {}) {
    if (!this.#process) throw new Error('Process not ready')
    return await this.#handler.sendCommand(command, data)
  }

  async stop() {
    if (!this.#process) return
    this.#handler.detachFrom()
    await stopProcess(this.#process)
    this.#process = null
    this.#httpPort = null
  }

  getHttpPort() {
    return this.#httpPort
  }
}

module.exports = { ProcessManager }
