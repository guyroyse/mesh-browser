// Shared utilities for external process communication
class ProcessUtils {
  static parseDataToMessages(data) {
    return data
      .toString()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => this.tryToParseJSON(line))
      .filter(line => line !== null)
  }

  static tryToParseJSON(line) {
    try {
      return JSON.parse(line)
    } catch (e) {
      console.error('Failed to parse process message:', line, e)
    }
    return null
  }
}

module.exports = { ProcessUtils }