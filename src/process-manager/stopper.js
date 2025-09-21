class ProcessStopper {
  async stop(process, messageHandler) {
    if (!process) return

    // Send shutdown command
    try {
      await messageHandler.sendCommand('shutdown')
    } catch (e) {
      // Ignore shutdown errors
    }

    // Force kill if still running
    setTimeout(() => {
      if (process) process.kill()
    }, 1000)
  }
}

module.exports = { ProcessStopper }