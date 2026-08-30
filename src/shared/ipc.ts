/**
 * The main ↔ renderer message contract.
 *
 * Shared rather than redeclared at each end: this payload was previously
 * described in the renderer's window.d.ts, which the main process does not
 * import, so the two could - and did - drift without the compiler noticing.
 *
 * Types only, so this erases at build time and creates no runtime dependency
 * between the processes.
 */

export interface NavigationUpdate {
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  /** Absent until a navigation commits; see did-start-loading in windows.ts. */
  url?: string
  error?: string
}
