export class Status {
  constructor() {
    this.statusIcon = document.querySelector('#status-icon')
    this.statusText = document.querySelector('#status-text')
    this.setReady()
  }

  get isLoading() {
    return this.statusIcon.classList.contains('loading')
  }

  setStatus(state, text) {
    this.statusIcon.className = `fas fa-circle ${state}`
    this.statusText.textContent = text
  }

  setLoading(message = 'Loading...') {
    this.setStatus('loading', message)
  }

  setReady() {
    this.setStatus('ready', 'Ready')
  }

  setError(message = 'Error') {
    this.setStatus('error', message)
  }
}
