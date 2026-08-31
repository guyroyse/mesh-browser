/**
 * The main process's copy of two renderer design tokens.
 *
 * `setBackgroundColor` paints the content view before a mesh page has painted
 * anything, which is what stops a white flash on every navigation. It needs a
 * literal colour, and the main process cannot read CSS - so these mirror
 * `--bg-primary` in src/renderer/shared/theme.css and must change with it.
 *
 * They are design decisions rather than preferences, so they deliberately do
 * not live in config.ts.
 */

export const contentBackground = {
  light: '#ffffff',
  dark: '#1a1a1a'
}
