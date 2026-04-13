import { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

const LIFECYCLE_FRAMES = ['STARTUP', 'SHUTDOWN', 'HTTP_STARTUP', 'HTTP_SHUTDOWN']
const LOG_FRAMES = ['ERROR', 'WARNING', 'INFO', 'DEBUG']

export class MessageHandler extends EventEmitter {
  #process: ChildProcess | null = null
  #buffer = ''

  attachTo(process: ChildProcess) {
    process.stdout!.on('data', (data: Buffer) => this.#onStdOut(data))
    process.on('close', (code: number | null) => this.#onProcessExit(code))
    process.on('error', (error: Error) => this.#onProcessError(error))

    this.#process = process
  }

  detachFrom() {
    if (this.#process) {
      this.#process.removeAllListeners('data')
      this.#process.removeAllListeners('close')
      this.#process.removeAllListeners('error')
      this.#process.stdout!.removeAllListeners('data')
      this.#process = null
    }
  }

  #onStdOut(data: Buffer) {
    this.#buffer += data.toString()

    if (this.#buffer.endsWith('\n')) {
      console.log('Process stdout (handler):', this.#buffer.trim())
      const messages = this.#parseLifecycleMessages(this.#buffer)
      for (const message of messages) this.#processMessage(message)
      this.#buffer = ''
    }
  }

  #onProcessExit(code: number | null) {
    console.log(`Process exited with code ${code}`)
  }

  #onProcessError(error: Error) {
    console.error('Process error:', error)
  }

  #parseLifecycleMessages(data: string) {
    const allFrames = [...LIFECYCLE_FRAMES, ...LOG_FRAMES]

    return data
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && this.#hasValidFrame(line, allFrames))
      .map(line => {
        const { frame, message } = this.#parseFramedMessage(line, allFrames)
        const parsedMessage = this.#tryParseJSON(message)
        if (parsedMessage) {
          parsedMessage._frame = frame
        }
        return parsedMessage
      })
      .filter(msg => msg !== null)
  }

  #hasValidFrame(line: string, frames: string[]) {
    return frames.some(frame => line.startsWith(`${frame}: `))
  }

  #parseFramedMessage(line: string, frames: string[]) {
    for (const frame of frames) {
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

  #tryParseJSON(line: string) {
    try {
      return JSON.parse(line)
    } catch (e) {
      console.error('Failed to parse framed message JSON:', line, e)
    }
    return null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #processMessage(message: any) {
    const frame = message._frame

    if (frame === 'ERROR') {
      console.error('Backend Error:', message.message)
      this.emit('error', message)
      return
    }

    if (frame === 'WARNING') {
      console.warn('Backend Warning:', message.message)
      this.emit('warning', message)
      return
    }

    if (frame === 'INFO') {
      console.info('Backend Info:', message.message)
      this.emit('info', message)
      return
    }

    if (frame === 'DEBUG') {
      console.debug('Backend Debug:', message.message)
      this.emit('debug', message)
      return
    }

    if (LIFECYCLE_FRAMES.includes(frame)) {
      console.log(`Lifecycle event '${frame}':`, message)
      this.emit(frame, message)
      return
    }
  }
}
