/**
 * A micron block tree -> an HTML fragment.
 *
 * Every text run is escaped, and the only tags emitted are the fixed set
 * below, so a page cannot inject markup no matter what a node sends.
 *
 * Styles land in inline `style` attributes rather than classes because micron
 * colours are arbitrary 24-bit values chosen per run - there is no finite set
 * to name.
 */

import { escapeHtml } from '../../../html'
import { resolveTarget } from './link-target'
import type { Align, Block, Run, Style } from './parse'

/** Matches the indent NomadNet gives each section level. */
const SECTION_INDENT_CH = 2

/* Comfortably past the widest page anyone draws; the row is clipped to the
   viewport, so over-filling costs nothing and under-filling shows a short rule */
const DIVIDER_WIDTH = 400

export interface RenderContext {
  /** The node the page came from; relative link targets resolve against it. */
  destHashHex: string
}

export function renderBlocks(blocks: Block[], context: RenderContext): string {
  const html: string[] = []
  const usedIds = new Set<string>()
  let openSections = 0

  const setDepth = (depth: number): void => {
    while (openSections > depth) {
      html.push('</section>')
      openSections--
    }

    while (openSections < depth) {
      openSections++

      /* The first level is not indented - NomadNet indents by (depth - 1), so
         a page whose whole body sits under one heading starts at the margin */
      const indent = openSections > 1 ? SECTION_INDENT_CH : 0

      html.push(`<section style="padding-left:${indent}ch">`)
    }
  }

  for (const block of blocks) {
    switch (block.kind) {
      case 'literal':
        /* Literal content is shown exactly as sent, at the current depth */
        html.push(`<pre>${escapeHtml(block.lines.join('\n'))}</pre>`)
        break

      case 'divider':
        setDepth(block.depth)
        html.push(dividerHtml(block.char))
        break

      case 'heading': {
        setDepth(block.depth)

        /* h1-h3 for structure only - the stylesheet renders all three at the
           body size, since a terminal heading occupies the same cell as any
           other row. Deeper sections keep indenting. */
        const level = Math.min(Math.max(block.depth, 1), 3)

        /* Headings anchor themselves: micron pages link to a section by the
           slug of its heading text, without the page declaring an anchor */
        const id = uniqueSlug(runsText(block.runs), usedIds)
        const idAttr = id ? ` id="${escapeHtml(id)}"` : ''

        html.push(
          `<h${level}${idAttr}${alignAttr(block.align)}>` +
            `${renderRuns(block.runs, context)}</h${level}>`
        )
        break
      }

      case 'paragraph': {
        setDepth(block.depth)

        /* A blank line is a blank line, not a collapsed nothing - micron
           authors space pages with them */
        const content = renderRuns(block.runs, context)

        html.push(`<p${alignAttr(block.align)}>${content || '<br>'}</p>`)
        break
      }
    }
  }

  setDepth(0)

  return html.join('\n')
}

/** The visible text of a run list, for slugs and titles. */
export function runsText(runs: Run[]): string {
  return runs
    .map((run) => (run.kind === 'text' || run.kind === 'link' ? run.text : ''))
    .join('')
    .trim()
}

/**
 * Slugify a heading the way micron's auto-anchors do: lowercased, runs of
 * anything that is not a letter or digit collapsed to a single dash.
 */
function uniqueSlug(text: string, used: Set<string>): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!base) return ''

  /* Two headings can share a text; the first keeps the bare slug so the common
     case still matches what a page links to */
  let slug = base
  let n = 2

  while (used.has(slug)) slug = `${base}-${n++}`

  used.add(slug)

  return slug
}

function renderRuns(runs: Run[], context: RenderContext): string {
  return runs.map((run) => renderRun(run, context)).join('')
}

function renderRun(run: Run, context: RenderContext): string {
  switch (run.kind) {
    case 'anchor':
      return `<span id="${escapeHtml(run.name)}"></span>`

    case 'text':
      return styled(escapeHtml(run.text), run.style)

    case 'field': {
      /* Forms are not implemented. Rendering the field visibly but inert beats
         both hiding it (the page stops making sense) and wiring it up (the
         submit would go nowhere). */
      const attrs = [
        `type="${run.masked ? 'password' : 'text'}"`,
        `value="${escapeHtml(run.value)}"`,
        `title="Form fields are not supported yet (${escapeHtml(run.name)})"`,
        'readonly',
        'disabled'
      ]

      return styled(`<input ${attrs.join(' ')}>`, run.style)
    }

    case 'link': {
      const resolved = resolveTarget(run.target, context.destHashHex)
      const label = escapeHtml(run.text || run.target)

      if ('unsupported' in resolved) {
        return styled(
          `<span class="dead-link" title="${escapeHtml(resolved.unsupported)}">${label}</span>`,
          run.style
        )
      }

      return styled(`<a href="${escapeHtml(resolved.href)}">${label}</a>`, run.style)
    }
  }
}

/** Wrap content in a span only when the run actually differs from the default. */
function styled(content: string, style: Style): string {
  const rules: string[] = []

  if (style.fg) rules.push(`color:${style.fg}`)
  if (style.bg) rules.push(`background-color:${style.bg}`)
  if (style.bold) rules.push('font-weight:bold')
  if (style.underline) rules.push('text-decoration:underline')
  if (style.italic) rules.push('font-style:italic')

  if (rules.length === 0) return content

  return `<span style="${rules.join(';')}">${content}</span>`
}

function alignAttr(align: Align): string {
  return align === 'left' ? '' : ` style="text-align:${align}"`
}

/**
 * A divider fills the line with its glyph, repeated and clipped.
 *
 * Deliberately not an <hr>: a divider occupies a whole row in a terminal, and
 * a 1px rule would sit a fraction of a row tall and shift everything below it
 * off the character grid the page was drawn on.
 */
function dividerHtml(char: string): string {
  return `<div class="divider" aria-hidden="true">${escapeHtml(char.repeat(DIVIDER_WIDTH))}</div>`
}
