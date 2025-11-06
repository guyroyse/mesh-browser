const { startProcess } = require('./starter')
const { MessageHandler } = require('./message-handler')
const { stopProcess } = require('./stopper')

class HttpProcessManager {
  #commands
  #args
  #options
  #handler
  #process = null
  #httpPort = null

  constructor(commands, args, options = {}) {
    this.#commands = commands
    this.#args = args
    this.#options = options
    this.#handler = new MessageHandler()

    // Listen for HTTP server ready event
    this.#handler.on('HTTP_STARTUP', data => {
      this.#httpPort = data.port
    })
  }

  async start() {
    const { process, httpPort } = await startProcess(this.#commands, this.#args, this.#options)

    if (httpPort) {
      this.#httpPort = httpPort
      console.log(`HttpProcessManager: HTTP server ready on port ${this.#httpPort}`)
    }

    this.#handler.attachTo(process)
    this.#process = process
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

module.exports = { HttpProcessManager }
