const { protocol } = require('electron')
const { setupAboutHandler } = require('./about-handler')
const { setupReticulumHandler } = require('./reticulum-handler')

function registerProtocolSchemes() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'reticulum',
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
  setupReticulumHandler()
}

module.exports = { registerProtocolSchemes, setupProtocolHandlers }
