// Supported message frame types from Python backend
const FRAME_TYPES = [
  'MESHBROWSER_MSG',
  'STARTUP',
  'SHUTDOWN',
  'ERROR',
  'WARNING',
  'INFO',
  'DEBUG'
]

function parseDataToMessages(data) {
  return data
    .toString()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && hasValidFrame(line))
    .map(line => {
      const { frame, message } = parseFramedMessage(line)
      const parsedMessage = tryToParseJSON(message)
      if (parsedMessage) {
        // Add frame type to message for handling
        parsedMessage._frame = frame
      }
      return parsedMessage
    })
    .filter(line => line !== null)
}

function hasValidFrame(line) {
  return FRAME_TYPES.some(frame => line.startsWith(`${frame}: `))
}

function parseFramedMessage(line) {
  for (const frame of FRAME_TYPES) {
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

function tryToParseJSON(line) {
  try {
    return JSON.parse(line)
  } catch (e) {
    console.error('Failed to parse framed message JSON:', line, e)
  }
  return null
}

module.exports = { parseDataToMessages }
