function parseDataToMessages(data) {
  return data
    .toString()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => tryToParseJSON(line))
    .filter(line => line !== null)
}

function tryToParseJSON(line) {
  try {
    return JSON.parse(line)
  } catch (e) {
    console.error('Failed to parse process message:', line, e)
  }
  return null
}

module.exports = { parseDataToMessages }
