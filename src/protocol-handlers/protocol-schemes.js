const { protocol } = require('electron')
const { setupAboutHandler } = require('./about-handler')
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
    },
    {
      scheme: 'about',
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
  setupAboutHandler()
  setupRwebHandler()
}

module.exports = { registerProtocolSchemes, setupProtocolHandlers }
