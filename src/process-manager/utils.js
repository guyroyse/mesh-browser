const MESSAGE_FRAME_PREFIX = 'MESHBROWSER_MSG: '

function parseDataToMessages(data) {
  return data
    .toString()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.startsWith(MESSAGE_FRAME_PREFIX))
    .map(line => {
      const message = line.substring(MESSAGE_FRAME_PREFIX.length)
      return tryToParseJSON(message)
    })
    .filter(line => line !== null)
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
