import { ChildProcess, spawn, SpawnOptions } from 'child_process'

const STARTUP_FRAMES = ['STARTUP', 'HTTP_STARTUP', 'ERROR']

interface StartResult {
  process: ChildProcess
  httpPort: number | null
}

export async function startProcess(
  commands: string[],
  args: string[],
  options: SpawnOptions = {}
): Promise<StartResult> {
  let lastError: Error | null = null

  for (const command of commands) {
    try {
      const result = await trySpawnProcess(command, args, options)
      console.log(`Successfully started process with command: ${command} ${args.join(' ')}`)
      return result
    } catch (error) {
      lastError = error as Error
      console.log(`Failed to start with '${command} ${args.join(' ')}': ${(error as Error).message}`)
    }
  }

  throw new Error(
    `Failed to start process with any command. Tried: ${commands.join(', ')}. ` + `Last error: ${lastError?.message}`
  )
}

function trySpawnProcess(command: string, args: string[], options: SpawnOptions): Promise<StartResult> {
  return new Promise((resolve, reject) => {
    const process = spawnProcess(command, args, options)
    let httpPort: number | null = null

    const timeout = setTimeout(() => {
      cleanup(timeout, process)
      reject(new Error('Process startup timeout'))
    }, 5000)

    const cleanupAndReject = (error: Error) => {
      cleanup(timeout, process)
      reject(error)
    }

    const cleanupAndResolve = () => {
      cleanup(timeout, process)
      resolve({ process, httpPort })
    }

    process.on('error', cleanupAndReject)

    process.stdout!.on('data', (data: Buffer) => {
      try {
        const result = processStartupMessage(data)
        if (result.httpPort) httpPort = result.httpPort
        if (result.ready) cleanupAndResolve()
      } catch (error) {
        cleanupAndReject(error as Error)
      }
    })
  })
}

function spawnProcess(command: string, args: string[], options: SpawnOptions): ChildProcess {
  const processOptions: SpawnOptions = { stdio: ['pipe', 'pipe', 'pipe'], ...options }
  return spawn(command, args, processOptions)
}

function processStartupMessage(data: Buffer) {
  console.log(data.toString().trim())
  const messages = parseStartupMessages(data.toString())
  if (messages.length === 0) return { ready: false, httpPort: null }

  let httpPort: number | null = null
  let ready = false

  for (const message of messages) {
    if (message._frame === 'HTTP_STARTUP' && message.port) {
      httpPort = message.port
      console.log(`Startup: Captured HTTP port ${httpPort}`)
    }

    if (message._frame === 'STARTUP' || message.type === 'startup') {
      ready = true
      console.log('Startup: Backend ready signal received')
    }
  }

  return { ready, httpPort }
}

function parseStartupMessages(data: string) {
  return data
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && hasValidFrame(line))
    .map(line => {
      const { frame, message } = parseFramedMessage(line)
      const parsedMessage = tryParseJSON(message)
      if (parsedMessage) {
        parsedMessage._frame = frame
      }
      return parsedMessage
    })
    .filter(msg => msg !== null)
}

function hasValidFrame(line: string) {
  return STARTUP_FRAMES.some(frame => line.startsWith(`${frame}: `))
}

function parseFramedMessage(line: string) {
  for (const frame of STARTUP_FRAMES) {
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

function tryParseJSON(line: string) {
  try {
    return JSON.parse(line)
  } catch (e) {
    console.error('Failed to parse framed message JSON:', line, e)
  }
  return null
}

function cleanup(timeout: NodeJS.Timeout, process: ChildProcess) {
  if (timeout) clearTimeout(timeout)
  if (process) {
    process.removeAllListeners('error')
    process.stdout!.removeAllListeners('data')
  }
}
