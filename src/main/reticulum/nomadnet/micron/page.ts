/**
 * A rendered micron fragment -> a complete HTML document.
 *
 * Micron is a fixed-width medium: dividers fill the line, literal blocks are
 * drawn on a character grid, and authors align columns with spaces. So this
 * renders as a terminal that happens to be inside a browser, not as a web page
 * - anything else breaks other people's pages.
 *
 * Deliberately dark in both themes rather than following the reader's. Every
 * other NomadNet client renders light-on-dark, page authors pick their colours
 * against that, and a light ground makes their choices illegible.
 */

import { escapeHtml } from '../../../html'
import type { Block } from './parse'
import { runsText } from './render'

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
  :root {
    color-scheme: dark;
    --ground: #101014;
    --ink: #d6d6d0;
    --rule: #4b4b54;
    --dead: #6f6f79;
  }
  body {
    margin: 0;
    padding: 1rem 2ch 2rem;
    background: var(--ground);
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 14px;
    /* Exactly one row per line, so box-drawing characters meet the ones above
       and below them. Anything more and a page's art comes apart. */
    line-height: 1;
    max-width: 100ch;
  }
  /* Every block is one row of the same size. Headings are bold, not bigger:
     in a terminal they occupy the same cell as everything else, and growing
     them here would push the rest of the page off the grid. */
  h1, h2, h3, p, pre { font-size: 1em; margin: 0; }
  h1, h2, h3 { font-weight: bold; }
  p { white-space: pre-wrap; }
  pre { white-space: pre; overflow-x: auto; }
  section { border-left: 1px solid var(--rule); }
  .divider { overflow: hidden; white-space: nowrap; color: var(--rule); }
  a { color: inherit; text-underline-offset: 2px; }
  .dead-link { color: var(--dead); text-decoration: line-through; cursor: not-allowed; }
  /* No border or padding: either would make the field taller than its row */
  input {
    font: inherit; line-height: inherit; color: inherit;
    background: transparent; border: 0; padding: 0;
    text-decoration: underline; text-decoration-color: var(--rule);
  }
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

    const text = runsText(block.runs)

    if (text) return text
  }

  return null
}
