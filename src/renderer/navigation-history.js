export class NavigationHistory {
  #history = []
  #currentIndex = -1

  constructor() {
    this.#history = []
    this.#currentIndex = -1
  }

  get canGoBack() {
    return this.#currentIndex > 0
  }

  get canGoForward() {
    return this.#currentIndex < this.#history.length - 1
  }

  get currentUrl() {
    return this.#currentIndex >= 0 ? this.#history[this.#currentIndex] : null
  }

  add(url) {
    // Remove any forward history if we're not at the end
    if (this.#currentIndex < this.#history.length - 1) {
      this.#history = this.#history.slice(0, this.#currentIndex + 1)
    }

    this.#history.push(url)
    this.#currentIndex = this.#history.length - 1
  }

  goBack() {
    if (this.canGoBack()) {
      this.#currentIndex--
      return this.#history[this.#currentIndex]
    }
    return null
  }

  goForward() {
    if (this.canGoForward()) {
      this.#currentIndex++
      return this.#history[this.#currentIndex]
    }
    return null
  }
}
