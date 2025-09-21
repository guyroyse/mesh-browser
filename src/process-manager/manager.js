const { startProcess } = require('./starter')
const { MessageHandler } = require('./message-handler')
const { stopProcess } = require('./stopper')

class ProcessManager {
  #command
  #args
  #options
  #handler
  #process = null

  constructor(command, args, options = {}) {
    this.#command = command
    this.#args = args
    this.#options = options
    this.#handler = new MessageHandler()
  }

  async start() {
    const process = await startProcess(this.#command, this.#args, this.#options)
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
  }
}

module.exports = { ProcessManager }
