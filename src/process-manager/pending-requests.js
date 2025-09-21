class PendingRequests {
  #requests = new Map()

  add(requestId, resolve, reject, timeoutMs = 10000) {
    const timeoutId = setTimeout(() => {
      this.reject(requestId, new Error('Request timeout'))
    }, timeoutMs)

    this.#requests.set(requestId, { resolve, reject, timeoutId })
  }

  resolve(requestId, data) {
    if (this.#requests.has(requestId)) {
      const { resolve, timeoutId } = this.#requests.get(requestId)
      clearTimeout(timeoutId)
      this.#requests.delete(requestId)
      resolve(data)
    } else {
      console.log(`Request ${requestId} not found for resolution`)
    }
  }

  reject(requestId, error) {
    if (this.#requests.has(requestId)) {
      const { reject, timeoutId } = this.#requests.get(requestId)
      clearTimeout(timeoutId)
      this.#requests.delete(requestId)
      reject(error)
    } else {
      console.log(`Request ${requestId} not found for rejection`)
    }
  }

  rejectAll(error) {
    const requestIds = Array.from(this.#requests.keys())
    console.log(`Rejecting ${requestIds.length} pending requests: ${requestIds.join(', ')}`)

    for (const requestId of requestIds) this.reject(requestId, error)
  }
}

module.exports = { PendingRequests }
