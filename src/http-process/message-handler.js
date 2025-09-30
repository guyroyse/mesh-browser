const { EventEmitter } = require('events')

// Lifecycle frame types sent by Python backend
const LIFECYCLE_FRAMES = ['STARTUP', 'SHUTDOWN', 'HTTP_STARTUP', 'HTTP_SHUTDOWN']
const LOG_FRAMES = ['ERROR', 'WARNING', 'INFO', 'DEBUG']

class MessageHandler extends EventEmitter {
  #process = null
  #buffer = ''

  constructor() {
    super()
  }

  attachTo(process) {
    process.stdout.on('data', data => this.#onStdOut(data))
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
      this.#process = null
    }
  }

  #onStdOut(data) {
    // Accumulate data in buffer
    this.#buffer += data.toString()

    // Check if we have complete lines (ending with \n)
    if (this.#buffer.endsWith('\n')) {
      // Process all complete lines
      console.log('Process stdout (handler):', this.#buffer.trim())
      const messages = this.#parseLifecycleMessages(this.#buffer)
      for (const message of messages) this.#processMessage(message)
      this.#buffer = ''
    }
    // If no trailing newline, keep buffering until we get a complete message
  }

  #onProcessExit(code) {
    console.log(`Process exited with code ${code}`)
  }

  #onProcessError(error) {
    console.error('Process error:', error)
  }

  #parseLifecycleMessages(data) {
    const allFrames = [...LIFECYCLE_FRAMES, ...LOG_FRAMES]

    return data
      .toString()
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

  #hasValidFrame(line, frames) {
    return frames.some(frame => line.startsWith(`${frame}: `))
  }

  #parseFramedMessage(line, frames) {
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

  #tryParseJSON(line) {
    try {
      return JSON.parse(line)
    } catch (e) {
      console.error('Failed to parse framed message JSON:', line, e)
    }
    return null
  }

  #processMessage(message) {
    const frame = message._frame

    // Forward log messages to console for troubleshooting
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

    // Emit lifecycle events (STARTUP, HTTP_STARTUP, SHUTDOWN, HTTP_SHUTDOWN)
    if (LIFECYCLE_FRAMES.includes(frame)) {
      console.log(`Lifecycle event '${frame}':`, message)
      this.emit(frame, message)
      return
    }
  }
}

module.exports = { MessageHandler }
