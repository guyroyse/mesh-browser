import { ChildProcess, SpawnOptions } from 'child_process'

import { startProcess } from './starter'
import { MessageHandler } from './message-handler'
import { stopProcess } from './stopper'

export class HttpProcessManager {
  #commands: string[]
  #args: string[]
  #options: SpawnOptions
  #handler: MessageHandler
  #process: ChildProcess | null = null
  #httpPort: number | null = null

  constructor(commands: string[], args: string[], options: SpawnOptions = {}) {
    this.#commands = commands
    this.#args = args
    this.#options = options
    this.#handler = new MessageHandler()

    this.#handler.on('HTTP_STARTUP', (data: { port: number }) => {
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

  getHttpPort(): number | null {
    return this.#httpPort
  }
}
