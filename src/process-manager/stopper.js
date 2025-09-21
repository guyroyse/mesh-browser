async function stopProcess(process) {
  if (!process) return
  process.kill()
}

module.exports = { stopProcess }
