const { protocol } = require('electron')
const { setupRwebHandler } = require('./rweb-handler')

function registerProtocolSchemes() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'rweb',
      privileges: {
        supportFetchAPI: true,
        corsEnabled: true,
        standard: true,
        secure: true,
        allowServiceWorkers: true,
        bypassCSP: false
      }
    }
  ])
}

function setupProtocolHandlers() {
  setupRwebHandler()
}

module.exports = { registerProtocolSchemes, setupProtocolHandlers }
