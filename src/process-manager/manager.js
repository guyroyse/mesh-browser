const { ProcessStarter } = require('./starter')
const { MessageHandler } = require('./message-handler')
const { ProcessStopper } = require('./stopper')

class ProcessManager {
  #process = null
  #isReady = false

  constructor(command, args, options = {}) {
    this.starter = new ProcessStarter(command, args, options)
    this.handler = new MessageHandler()
    this.stopper = new ProcessStopper()
  }

  async start() {
    this.#process = await this.starter.start(() => {
      // Setup message handling after startup is confirmed
      this.handler.attachTo(this.#process)
      this.#isReady = true
    })
  }

  async sendCommand(command, data = {}) {
    if (!this.#isReady) throw new Error('Process not ready')
    return this.handler.sendCommand(command, data)
  }

  async stop() {
    if (!this.#isReady) return

    await this.stopper.stop(this.#process, this.handler)
    this.#isReady = false
    this.#process = null
  }
}

module.exports = { ProcessManager }