/**
 * Micron -> a block tree.
 *
 * Micron is line-oriented but its *state* is document-scoped: a colour or a
 * bold opened on one line stays open on the next until something resets it.
 * That is the single fact that shapes this parser and the renderer next door -
 * runs carry a full style snapshot rather than open/close tokens, because HTML
 * nesting cannot straddle a line boundary the way micron's state does.
 *
 * Written from micron's published format description. Two rules matter more
 * than any table below:
 *
 *  - An unrecognised sequence must never throw. Micron has constructs this
 *    parser does not implement, and a page using one has to degrade to a bit
 *    of visible junk on one line rather than a failed document.
 *  - The input is remote and untrusted, so both its size and the scan are
 *    bounded.
 */

/* A hostile node should not be able to turn a page fetch into a hang. Well
   past any real page; a node serving more than this is not serving a page. */
const MAX_SOURCE_BYTES = 4 * 1024 * 1024
const MAX_LINES = 20_000

/** Micron's default divider glyph. */
const DIVIDER_CHAR = '─'

export type Align = 'left' | 'center' | 'right'

export interface Style {
  /** `#rrggbb`, or null for the reader's default. */
  fg: string | null
  bg: string | null
  bold: boolean
  underline: boolean
  italic: boolean
}

export type Run =
  | { kind: 'text'; text: string; style: Style }
  | { kind: 'link'; text: string; target: string; style: Style }
  | { kind: 'field'; name: string; value: string; masked: boolean; style: Style }
  | { kind: 'anchor'; name: string }

export type Block =
  | { kind: 'paragraph'; depth: number; align: Align; runs: Run[] }
  | { kind: 'heading'; depth: number; align: Align; runs: Run[] }
  | { kind: 'divider'; depth: number; char: string }
  | { kind: 'literal'; lines: string[] }

interface State extends Style {
  depth: number
  align: Align
  literal: boolean
}

function initialState(): State {
  return {
    fg: null,
    bg: null,
    bold: false,
    underline: false,
    italic: false,
    depth: 0,
    align: 'left',
    literal: false
  }
}

function snapshot(state: State): Style {
  return {
    fg: state.fg,
    bg: state.bg,
    bold: state.bold,
    underline: state.underline,
    italic: state.italic
  }
}

function resetAll(state: State): void {
  state.fg = null
  state.bg = null
  state.bold = false
  state.underline = false
  state.italic = false
  state.align = 'left'
}

/** Parse micron source into blocks, carrying formatting state across lines. */
export function parseMicron(source: string): Block[] {
  const truncated = source.length > MAX_SOURCE_BYTES ? source.slice(0, MAX_SOURCE_BYTES) : source
  const lines = truncated.split(/\r?\n/).slice(0, MAX_LINES)

  const state = initialState()
  const blocks: Block[] = []
  let literalLines: string[] = []

  const flushLiteral = (): void => {
    if (literalLines.length === 0) return

    blocks.push({ kind: 'literal', lines: literalLines })
    literalLines = []
  }

  for (const line of lines) {
    if (state.literal) {
      if (line.trimEnd() === '`=') {
        state.literal = false
        flushLiteral()
      } else {
        literalLines.push(line)
      }

      continue
    }

    const block = parseLine(line, state)

    if (block) blocks.push(block)
  }

  /* An unterminated literal block still has to render */
  flushLiteral()

  return blocks
}

function parseLine(line: string, state: State): Block | null {
  if (line.trimEnd() === '`=') {
    state.literal = true
    return null
  }

  /* Comments never reach the reader */
  if (line.startsWith('#')) return null

  if (line.startsWith('-')) {
    const char = dividerChar(line)

    return { kind: 'divider', depth: state.depth, char }
  }

  if (line.startsWith('>')) {
    /* Depth is the count of '>' and takes no separating space */
    let depth = 0
    while (depth < line.length && line[depth] === '>') depth++

    state.depth = depth

    const runs = parseInline(line.slice(depth), state)

    return { kind: 'heading', depth, align: state.align, runs }
  }

  if (line.startsWith('<')) {
    /* '<' closes every open section, then the rest of the line is ordinary */
    state.depth = 0

    const runs = parseInline(line.slice(1), state)

    return { kind: 'paragraph', depth: 0, align: state.align, runs }
  }

  const runs = parseInline(line, state)

  return { kind: 'paragraph', depth: state.depth, align: state.align, runs }
}

/** `-` alone is the default rule; `-x` repeats x. Control characters are junk. */
function dividerChar(line: string): string {
  const char = line.slice(1, 2)

  if (!char) return DIVIDER_CHAR
  if (char.codePointAt(0)! < 32) return DIVIDER_CHAR

  return char
}

/**
 * Parse one line's inline markup, mutating the carried state.
 *
 * The default branch is the important one: an unknown sequence consumes the
 * backtick and emits the following character as text, so a construct this
 * parser does not know renders as noise rather than failing the page.
 */
function parseInline(line: string, state: State): Run[] {
  const runs: Run[] = []
  let text = ''

  const flush = (): void => {
    if (text.length === 0) return

    runs.push({ kind: 'text', text, style: snapshot(state) })
    text = ''
  }

  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (char === '\\') {
      /* Escape: the next character is literal, whatever it is */
      if (i + 1 < line.length) text += line[i + 1]
      i += 2
      continue
    }

    if (char !== '`') {
      text += char
      i++
      continue
    }

    const tag = line[i + 1]

    /* A trailing lone backtick is just a backtick */
    if (tag === undefined) {
      text += '`'
      i++
      continue
    }

    switch (tag) {
      case '`':
        flush()
        resetAll(state)
        i += 2
        break

      case '!':
        flush()
        state.bold = !state.bold
        i += 2
        break

      case '_':
        flush()
        state.underline = !state.underline
        i += 2
        break

      case '*':
        flush()
        state.italic = !state.italic
        i += 2
        break

      case 'f':
        flush()
        state.fg = null
        i += 2
        break

      case 'b':
        flush()
        state.bg = null
        i += 2
        break

      case 'F':
      case 'B': {
        const colour = readColour(line, i + 2)

        if (!colour) {
          /* Not a colour after all - emit the tag letter and move on */
          text += tag
          i += 2
          break
        }

        flush()

        if (tag === 'F') state.fg = colour.value
        else state.bg = colour.value

        i = colour.next
        break
      }

      case 'c':
      case 'l':
      case 'r':
        flush()
        state.align = tag === 'c' ? 'center' : tag === 'l' ? 'left' : 'right'
        i += 2
        break

      case 'a':
        flush()
        state.align = 'left'
        i += 2
        break

      case '[': {
        const link = readDelimited(line, i + 2, ']')

        if (!link) {
          text += '['
          i += 2
          break
        }

        flush()
        runs.push(buildLink(link.body, snapshot(state)))
        i = link.next
        break
      }

      case '<': {
        const field = readDelimited(line, i + 2, '>')

        if (!field) {
          text += '<'
          i += 2
          break
        }

        flush()
        runs.push(buildField(field.body, snapshot(state)))
        i = field.next
        break
      }

      case ':': {
        const anchor = readAnchorName(line, i + 2)

        flush()
        runs.push({ kind: 'anchor', name: anchor.name })
        i = anchor.next
        break
      }

      default:
        /* Unknown sequence: show it rather than swallowing or failing */
        text += tag
        i += 2
        break
    }
  }

  flush()

  return runs
}

/**
 * Read a three-digit colour.
 *
 * Micron's documented colour form is three hex digits, one per channel, which
 * expand by doubling. Six-digit forms are deliberately not guessed at: the
 * grammar has no terminator, so treating `F000abc` as six digits would eat
 * three characters of a page's text whenever the text happened to be hex.
 */
function readColour(line: string, start: number): { value: string; next: number } | null {
  const digits = line.slice(start, start + 3)

  if (!/^[0-9a-fA-F]{3}$/.test(digits)) return null

  const [r, g, b] = digits.toLowerCase()

  return { value: `#${r}${r}${g}${g}${b}${b}`, next: start + 3 }
}

function readDelimited(
  line: string,
  start: number,
  closer: string
): { body: string; next: number } | null {
  const end = line.indexOf(closer, start)

  if (end === -1) return null

  return { body: line.slice(start, end), next: end + 1 }
}

/** An anchor name runs to the next space; micron has no closing delimiter. */
function readAnchorName(line: string, start: number): { name: string; next: number } {
  let end = start

  while (end < line.length && !/\s/.test(line[end])) end++

  return { name: line.slice(start, end), next: end }
}

/**
 * `[label`target] and `[target] and `[label`target`fields].
 *
 * The backtick separates the parts. With one part the target doubles as its
 * own label, which is how bare destination links read in the wild. Field lists
 * are parsed off but not yet used - forms are not implemented.
 */
function buildLink(body: string, style: Style): Run {
  const parts = body.split('`')

  if (parts.length === 1) {
    return { kind: 'link', text: parts[0], target: parts[0], style }
  }

  return { kind: 'link', text: parts[0], target: parts[1], style }
}

/**
 * `<name`value>, `<24|name`value>, `<!16|name`value>.
 *
 * A leading `!` masks the field and a `width|` prefix sizes it; neither
 * changes what the field *is*, and v1 renders every field read-only.
 */
function buildField(body: string, style: Style): Run {
  const [head, value = ''] = splitOnce(body, '`')

  let spec = head
  let masked = false

  if (spec.startsWith('!')) {
    masked = true
    spec = spec.slice(1)
  }

  const bar = spec.indexOf('|')
  const name = bar === -1 ? spec : spec.slice(bar + 1)

  return { kind: 'field', name, value, masked, style }
}

function splitOnce(value: string, separator: string): [string, string?] {
  const index = value.indexOf(separator)

  if (index === -1) return [value]

  return [value.slice(0, index), value.slice(index + 1)]
}
