import { protocol } from 'electron'

import { setupRwebHandler } from './rweb-handler'

export function registerProtocolSchemes() {
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

export function setupProtocolHandlers() {
  setupRwebHandler()
}
