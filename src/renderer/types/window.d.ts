interface NavigationUpdate {
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  error?: string
}

interface BrowserAPI {
  navigate: (url: string) => Promise<void>
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  refresh: () => Promise<void>
  canGoBack: () => Promise<boolean>
  canGoForward: () => Promise<boolean>
  getURL: () => Promise<string>
  onNavigationUpdate: (callback: (data: NavigationUpdate) => void) => void
  onUrlChanged: (callback: (url: string) => void) => void
}

declare global {
  interface Window {
    browserAPI: BrowserAPI
  }
}

export {}
