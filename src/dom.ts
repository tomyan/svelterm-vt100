/**
 * DOM renderer for a Terminal's cell grid.
 *
 * Renders the grid as a container of row divs, each containing styled
 * spans. Uses dirty tracking to only update changed rows.
 */

import type { Terminal } from './terminal.js'
import type { Cell, Color } from './cell.js'
import { Attr } from './cell.js'
import { BLOCKS_FONT_CSS } from './blocks-font.js'

export interface TerminalRendererOptions {
    /** Font family for the terminal. Default: monospace */
    fontFamily?: string
    /** Font size in px. Default: 14 */
    fontSize?: number
    /** Line height as a multiplier. Default: 1.2 */
    lineHeight?: number
    /** Default foreground color. Default: #cccccc */
    foreground?: string
    /** Default background color. Default: #000000 */
    background?: string
}

const DEFAULT_OPTIONS: Required<TerminalRendererOptions> = {
    fontFamily: "'SveltermBlocks', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontSize: 14,
    lineHeight: 1.2,
    foreground: '#cccccc',
    background: '#000000',
}

/**
 * Install the @font-face declaration for SveltermBlocks exactly once per document.
 * Block-element and box-drawing glyphs are served from this font with metrics
 * that fill the em box edge-to-edge; the browser falls back to the next font
 * in the stack for every other codepoint.
 *
 * Measures the fallback font's character width and injects a `size-adjust`
 * descriptor so our font's advance matches the fallback's exactly. Without
 * this, mixing our glyphs with fallback-font glyphs drifts horizontally by
 * the ratio mismatch, breaking cell alignment along a row.
 */
let fontInstalled: WeakSet<Document> | null = null
function installBlocksFont(doc: Document, fallbackFontFamily: string): void {
    if (!fontInstalled) fontInstalled = new WeakSet()
    if (fontInstalled.has(doc)) return
    fontInstalled.add(doc)

    // Install immediately with 100% size-adjust so our font is available
    // during the first frames. Most monospace fallbacks (JetBrains Mono,
    // Cascadia Code, Fira Code, etc.) have exactly 0.6 advance, matching
    // ours — so 100% is correct for them with no flicker.
    const style = doc.createElement('style')
    style.setAttribute('data-svelterm-blocks-font', '')
    style.textContent = renderFontFaceCss(100)
    doc.head.appendChild(style)

    // When fallback fonts finish loading, re-measure and update size-adjust
    // if it doesn't match. Fonts ship as webfonts that can load after page
    // init, so the initial measurement would see the wrong fallback.
    doc.fonts.ready.then(() => {
        const adjust = computeFontSizeAdjust(doc, fallbackFontFamily)
        if (Math.abs(adjust - 100) > 0.01) {
            style.textContent = renderFontFaceCss(adjust)
        }
    })
}

function renderFontFaceCss(sizeAdjust: number): string {
    return BLOCKS_FONT_CSS.replace(
        /font-display: block;/,
        `font-display: block;\n    size-adjust: ${sizeAdjust}%;`,
    )
}

/**
 * Install the grid stylesheet once per document. Rows are direct children
 * of the marked container; cells are direct children of rows. Common
 * positional styles live here so the renderer only emits inline styles for
 * per-cell varying values (left, colour, bg, attr flags).
 *
 * overflow-y: visible on cells lets glyphs bleed vertically (needed for
 * block-character stacking); overflow-x: clip prevents sideways bleed so a
 * tall or wide glyph can't leak colour into an adjacent content cell.
 * Row-level clip-path caps vertical bleed at ~1px past the row's bottom so
 * the next row paints over most of it except where a subpixel gap would show.
 */
let gridStylesInstalled: WeakSet<Document> | null = null
const GRID_STYLES = `
[data-svt-grid] > div {
    position: absolute;
    left: 0;
    right: 0;
    overflow: clip;
    clip-path: inset(0 0 -1px 0);
}
[data-svt-grid] > div > div {
    position: absolute;
    top: 0;
    text-align: center;
    overflow-x: clip;
    overflow-y: visible;
}
`
function installGridStyles(doc: Document): void {
    if (!gridStylesInstalled) gridStylesInstalled = new WeakSet()
    if (gridStylesInstalled.has(doc)) return
    gridStylesInstalled.add(doc)
    const style = doc.createElement('style')
    style.setAttribute('data-svelterm-grid', '')
    style.textContent = GRID_STYLES
    doc.head.appendChild(style)
}

/**
 * Compute the size-adjust percentage that makes our font's advance match
 * the fallback font's advance at the same CSS font-size.
 *
 * Our glyphs use advanceWidth = 600 within a 1000-unit em (ratio 0.6).
 * If the fallback's advance ratio is R, setting size-adjust to (R / 0.6)
 * scales our font so its rendered advance matches the fallback's.
 */
const OUR_ADVANCE_RATIO = 0.6  // matches ADVANCE/UNITS_PER_EM in build-blocks-font.mjs
function computeFontSizeAdjust(doc: Document, fallbackFontFamily: string): number {
    // Strip SveltermBlocks from the font stack — if it's loaded when we measure,
    // the browser uses its advance width even for chars it doesn't have (like 'M'),
    // which would make us measure our own width and compute a no-op 100%.
    const strippedFamily = fallbackFontFamily
        .replace(/'SveltermBlocks'\s*,\s*/g, '')
        .replace(/"SveltermBlocks"\s*,\s*/g, '')
        .replace(/SveltermBlocks\s*,\s*/g, '')
    const REF_SIZE = 100
    const span = doc.createElement('span')
    span.style.fontFamily = strippedFamily
    span.style.fontSize = `${REF_SIZE}px`
    span.style.position = 'absolute'
    span.style.visibility = 'hidden'
    span.style.whiteSpace = 'pre'
    span.textContent = 'M'
    doc.body.appendChild(span)
    const fallbackAdvance = span.getBoundingClientRect().width
    doc.body.removeChild(span)
    const fallbackRatio = fallbackAdvance / REF_SIZE
    return Math.round((fallbackRatio / OUR_ADVANCE_RATIO) * 10000) / 100
}

export class TerminalRenderer {
    private container: HTMLElement
    private terminal: Terminal
    private options: Required<TerminalRendererOptions>
    private rowElements: HTMLElement[] = []
    private cursorElement: HTMLElement | null = null
    private animFrame: number | null = null

    constructor(container: HTMLElement, terminal: Terminal, options?: TerminalRendererOptions) {
        this.container = container
        this.terminal = terminal
        this.options = { ...DEFAULT_OPTIONS, ...options }
        installBlocksFont(container.ownerDocument, this.options.fontFamily)
        this.setupContainer()
        this.createRows()
        this.renderAll()
        this.terminal.clearDirty()
    }

    /** Schedule a render on the next animation frame */
    scheduleRender(): void {
        if (this.animFrame !== null) return
        this.animFrame = requestAnimationFrame(() => {
            this.animFrame = null
            this.render()
        })
    }

    /** Render immediately — only dirty rows */
    render(): void {
        const dirty = this.terminal.getDirtyRows()
        if (dirty.size === 0) return

        // Handle resize
        if (this.rowElements.length !== this.terminal.rows) {
            this.createRows()
            this.renderAll()
        } else {
            for (const row of dirty) {
                if (row < this.rowElements.length) {
                    this.renderRow(row)
                }
            }
        }

        this.updateCursor()
        this.terminal.clearDirty()
    }

    /** Clean up */
    dispose(): void {
        if (this.animFrame !== null) {
            cancelAnimationFrame(this.animFrame)
            this.animFrame = null
        }
        this.container.innerHTML = ''
        this.rowElements = []
        this.cursorElement = null
    }

    private setupContainer(): void {
        const style = this.container.style
        style.fontFamily = this.options.fontFamily
        style.fontSize = `${this.options.fontSize}px`
        style.lineHeight = `${this.options.lineHeight}`
        style.backgroundColor = this.options.background
        style.color = this.options.foreground
        style.whiteSpace = 'pre'
        style.overflow = 'hidden'
        style.position = 'relative'
        // Marker so our stylesheet can target rows/cells without per-element classes.
        this.container.setAttribute('data-svt-grid', '')
        installGridStyles(this.container.ownerDocument)
    }

    private createRows(): void {
        this.container.innerHTML = ''
        this.rowElements = []

        // Each row is a positional container; cells inside are absolutely
        // positioned divs at exact (col * charWidth, row * lineHeight).
        // Common positional styles come from the installed stylesheet; only
        // per-row values (top, height) are set inline.
        const lineHeight = this.lineHeightPx()
        for (let r = 0; r < this.terminal.rows; r++) {
            const rowEl = document.createElement('div')
            rowEl.style.top = `${r * lineHeight}px`
            rowEl.style.height = `${lineHeight}px`
            this.container.appendChild(rowEl)
            this.rowElements.push(rowEl)
        }

        // Cursor overlay
        this.cursorElement = document.createElement('div')
        this.cursorElement.style.position = 'absolute'
        this.cursorElement.style.pointerEvents = 'none'
        this.container.appendChild(this.cursorElement)
    }

    private lineHeightPx(): number {
        return Math.round(this.options.fontSize * this.options.lineHeight)
    }

    private renderAll(): void {
        for (let r = 0; r < this.terminal.rows; r++) {
            this.renderRow(r)
        }
        this.updateCursor()
    }

    private renderRow(row: number): void {
        const rowEl = this.rowElements[row]
        rowEl.innerHTML = ''

        const charWidth = this.measureCharWidth()
        const lineHeight = this.lineHeightPx()

        for (let col = 0; col < this.terminal.cols; col++) {
            const cell = this.terminal.getCell(col, row)
            rowEl.appendChild(this.createCell(cell, col, charWidth, lineHeight))
        }
    }

    /**
     * Create an absolutely-positioned cell at its grid coordinate. Only
     * varying/non-default values are set inline; common positional styles
     * come from the grid stylesheet keyed off the container's data attribute.
     */
    private createCell(cell: Cell, col: number, charWidth: number, lineHeight: number): HTMLElement {
        const el = document.createElement('div')
        const style = el.style
        style.left = `${col * charWidth}px`
        style.width = `${charWidth}px`
        style.height = `${lineHeight}px`
        style.lineHeight = `${lineHeight}px`

        const fg = this.resolveColor(cell.fg, true)
        const bg = this.resolveColor(cell.bg, false)
        const isInverse = (cell.attrs & Attr.Inverse) !== 0
        const effectiveFg = isInverse ? (bg || this.options.background) : fg
        const effectiveBg = isInverse ? (fg || this.options.foreground) : bg

        if (effectiveFg) style.color = effectiveFg
        if (effectiveBg) style.backgroundColor = effectiveBg
        if (cell.attrs & Attr.Bold) style.fontWeight = 'bold'
        if (cell.attrs & Attr.Dim) style.opacity = '0.5'
        if (cell.attrs & Attr.Italic) style.fontStyle = 'italic'

        const decorations: string[] = []
        if (cell.attrs & Attr.Underline) decorations.push('underline')
        if (cell.attrs & Attr.Strikethrough) decorations.push('line-through')
        if (decorations.length) style.textDecoration = decorations.join(' ')
        if (cell.attrs & Attr.Invisible) style.visibility = 'hidden'

        el.textContent = cell.char
        return el
    }

    private resolveColor(color: Color, isFg: boolean): string | null {
        switch (color.type) {
            case 'default':
                return null
            case 'rgb':
                return `rgb(${color.r},${color.g},${color.b})`
            case 'indexed':
                return indexedColorToHex(color.index)
        }
    }

    private updateCursor(): void {
        if (!this.cursorElement) return
        const cursor = this.terminal.cursor

        if (!cursor.visible) {
            this.cursorElement.style.display = 'none'
            return
        }

        const charWidth = this.measureCharWidth()
        const lineHeight = this.options.fontSize * this.options.lineHeight

        this.cursorElement.style.display = 'block'
        this.cursorElement.style.left = `${cursor.col * charWidth}px`
        this.cursorElement.style.top = `${cursor.row * lineHeight}px`
        this.cursorElement.style.width = `${charWidth}px`
        this.cursorElement.style.height = `${lineHeight}px`
        this.cursorElement.style.backgroundColor = this.options.foreground
        this.cursorElement.style.opacity = '0.5'
    }

    private _charWidth: number | null = null
    private measureCharWidth(): number {
        if (this._charWidth !== null) return this._charWidth
        const span = document.createElement('span')
        span.style.fontFamily = this.options.fontFamily
        span.style.fontSize = `${this.options.fontSize}px`
        span.style.position = 'absolute'
        span.style.visibility = 'hidden'
        span.style.whiteSpace = 'pre'
        span.textContent = 'M'
        document.body.appendChild(span)
        this._charWidth = span.getBoundingClientRect().width
        document.body.removeChild(span)
        return this._charWidth
    }
}

/** Map 256-color index to hex */
function indexedColorToHex(index: number): string {
    if (index < 16) return ANSI_16[index]
    if (index < 232) {
        // 6x6x6 color cube
        const n = index - 16
        const b = (n % 6) * 51
        const g = (Math.floor(n / 6) % 6) * 51
        const r = Math.floor(n / 36) * 51
        return `rgb(${r},${g},${b})`
    }
    // Grayscale ramp
    const v = (index - 232) * 10 + 8
    return `rgb(${v},${v},${v})`
}

const ANSI_16 = [
    '#000000', '#aa0000', '#00aa00', '#aa5500',
    '#0000aa', '#aa00aa', '#00aaaa', '#aaaaaa',
    '#555555', '#ff5555', '#55ff55', '#ffff55',
    '#5555ff', '#ff55ff', '#55ffff', '#ffffff',
]
