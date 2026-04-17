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

/** Unicode Block Elements range — chars drawn by our custom font */
function hasBlockChar(text: string): boolean {
    for (let i = 0; i < text.length; i++) {
        const cp = text.charCodeAt(i)
        if (cp >= 0x2580 && cp <= 0x259F) return true
    }
    return false
}

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
 * Block-element glyphs (U+2580–U+259F) are served from this font with metrics
 * that fill the em box edge-to-edge; the browser falls back to the next font
 * in the stack for every other codepoint.
 */
let fontInstalled: WeakSet<Document> | null = null
function installBlocksFont(doc: Document): void {
    if (!fontInstalled) fontInstalled = new WeakSet()
    if (fontInstalled.has(doc)) return
    const style = doc.createElement('style')
    style.setAttribute('data-svelterm-blocks-font', '')
    style.textContent = BLOCKS_FONT_CSS
    doc.head.appendChild(style)
    fontInstalled.add(doc)
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
        installBlocksFont(container.ownerDocument)
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
        style.backgroundColor = 'transparent'
        style.color = this.options.foreground
        style.whiteSpace = 'pre'
        style.overflow = 'hidden'
        style.position = 'relative'
    }

    private createRows(): void {
        this.container.innerHTML = ''
        this.rowElements = []

        for (let r = 0; r < this.terminal.rows; r++) {
            const rowEl = document.createElement('div')
            rowEl.style.backgroundColor = this.options.background
            this.container.appendChild(rowEl)
            this.rowElements.push(rowEl)
        }

        // Cursor overlay
        this.cursorElement = document.createElement('div')
        this.cursorElement.style.position = 'absolute'
        this.cursorElement.style.pointerEvents = 'none'
        this.container.appendChild(this.cursorElement)
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

        let spanStart = 0
        let spanChars = ''
        let lastStyle = ''

        for (let col = 0; col < this.terminal.cols; col++) {
            const cell = this.terminal.getCell(col, row)
            const style = this.cellStyle(cell)

            if (style !== lastStyle && spanChars.length > 0) {
                rowEl.appendChild(this.createSpan(spanChars, lastStyle))
                spanChars = ''
            }

            spanChars += cell.char
            lastStyle = style
        }

        if (spanChars.length > 0) {
            rowEl.appendChild(this.createSpan(spanChars, lastStyle))
        }
    }

    private createSpan(text: string, style: string): HTMLSpanElement {
        const span = document.createElement('span')
        span.textContent = text
        // Only spans containing block-element characters get the subpixel-gap
        // workaround: inline-block with a 0.5px negative margin-top shifts the
        // box off the subpixel boundary where gaps appear between stacked
        // glyphs. Applying to every span (including box-drawing chars) would
        // disturb their cell-centered strokes, so we scope it to block chars.
        const style0 = hasBlockChar(text)
            ? `display:inline-block;vertical-align:top;margin-top:-0.5px`
            : ''
        const combined = [style0, style].filter(Boolean).join(';')
        if (combined) span.setAttribute('style', combined)
        return span
    }

    private cellStyle(cell: Cell): string {
        const parts: string[] = []

        const fg = this.resolveColor(cell.fg, true)
        const bg = this.resolveColor(cell.bg, false)

        const isInverse = (cell.attrs & Attr.Inverse) !== 0
        const effectiveFg = isInverse ? (bg || this.options.background) : fg
        const effectiveBg = isInverse ? (fg || this.options.foreground) : bg

        if (effectiveFg) parts.push(`color:${effectiveFg}`)
        if (effectiveBg) parts.push(`background-color:${effectiveBg}`)
        if (cell.attrs & Attr.Bold) parts.push('font-weight:bold')
        if (cell.attrs & Attr.Dim) parts.push('opacity:0.5')
        if (cell.attrs & Attr.Italic) parts.push('font-style:italic')

        const decorations: string[] = []
        if (cell.attrs & Attr.Underline) decorations.push('underline')
        if (cell.attrs & Attr.Strikethrough) decorations.push('line-through')
        if (decorations.length) parts.push(`text-decoration:${decorations.join(' ')}`)

        if (cell.attrs & Attr.Invisible) parts.push('visibility:hidden')

        return parts.join(';')
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
