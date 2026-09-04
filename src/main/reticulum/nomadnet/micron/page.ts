/**
 * A rendered micron fragment -> a complete HTML document.
 *
 * Micron is a fixed-width medium: dividers fill the line, literal blocks are
 * drawn on a character grid, and authors align columns with spaces. So this
 * renders as a terminal that happens to be inside a browser, not as a web page
 * - anything else breaks other people's pages.
 */

import { escapeHtml } from '../../../html'
import type { Block } from './parse'

/**
 * Micron pages cannot script, so nothing here needs to. Inline styles are the
 * one allowance, because per-run colours are attributes on the elements
 * themselves.
 */
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src nomadnet:"

/*
 * Inline, not a stylesheet link: a `nomadnet://` URL would be fetched as a
 * mesh request, and any other origin is blocked by the policy above.
 */
const STYLES = `
  :root { color-scheme: light dark; --ground: #fbfbfa; --ink: #1a1a19; --rule: #c9c9c4; --dead: #8a8a85; }
  @media (prefers-color-scheme: dark) {
    :root { --ground: #16161a; --ink: #e6e6e3; --rule: #3a3a40; --dead: #77777f; }
  }
  body {
    margin: 0;
    padding: 1.5rem 2ch 3rem;
    background: var(--ground);
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 14px;
    line-height: 1.45;
    max-width: 100ch;
  }
  h1, h2, h3 { font-size: 1em; font-weight: bold; margin: 1.2em 0 0.4em; }
  h1 { font-size: 1.3em; }
  h2 { font-size: 1.15em; }
  p { margin: 0 0 0.15em; white-space: pre-wrap; overflow-wrap: anywhere; }
  pre { margin: 0.6em 0; white-space: pre; overflow-x: auto; }
  section { border-left: 1px solid var(--rule); }
  hr { border: 0; border-top: 1px solid var(--rule); margin: 0.8em 0; }
  .divider { overflow: hidden; white-space: nowrap; color: var(--rule); }
  a { color: inherit; text-underline-offset: 2px; }
  .dead-link { color: var(--dead); text-decoration: line-through; cursor: not-allowed; }
  input { font: inherit; color: inherit; background: transparent;
          border: 1px solid var(--rule); padding: 0 0.5ch; }
`

/** Wrap a rendered fragment in a document, titled from the page's first heading. */
export function micronPage(fragment: string, blocks: Block[], path: string): string {
  const title = firstHeadingText(blocks) ?? path

  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
    `<title>${escapeHtml(title)}</title>`,
    `<style>${STYLES}</style>`,
    '</head>',
    '<body>',
    fragment,
    '</body>',
    '</html>'
  ].join('\n')
}

/** windows.ts turns this into the window title, so it is worth getting right. */
function firstHeadingText(blocks: Block[]): string | null {
  for (const block of blocks) {
    if (block.kind !== 'heading') continue

    const text = block.runs
      .map((run) => (run.kind === 'text' || run.kind === 'link' ? run.text : ''))
      .join('')
      .trim()

    if (text) return text
  }

  return null
}
