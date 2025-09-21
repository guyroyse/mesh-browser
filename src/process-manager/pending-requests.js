class PendingRequests {
  #requests = new Map()

  add(requestId, resolve, reject, timeoutMs = 10000) {
    this.#requests.set(requestId, { resolve, reject })

    setTimeout(() => {
      this.reject(requestId, new Error('Request timeout'))
    }, timeoutMs)
  }

  resolve(requestId, data) {
    if (this.#requests.has(requestId)) {
      const { resolve } = this.#requests.get(requestId)
      this.#requests.delete(requestId)
      resolve(data)
    } else {
      console.log(`Request ${requestId} not found for resolution`)
    }
  }

  reject(requestId, error) {
    if (this.#requests.has(requestId)) {
      const { reject } = this.#requests.get(requestId)
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
