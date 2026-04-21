/**
 * DOM renderer for a Terminal's cell grid.
 *
 * Renders the grid as a container of row divs, each containing styled
 * spans. Uses dirty tracking to only update changed rows.
 */

import type { Terminal } from './terminal.js'
import type { Cell, Color } from './cell.js'
import { Attr } from './cell.js'

/**
 * Return a CSS `background-image` value for a block-element character
 * (U+2580–U+259F) that draws the glyph as a pixel-precise fill in `color`.
 * Returns null for characters outside that range.
 *
 * Rendering block elements as CSS gradients side-steps font rasterisation
 * artefacts at small sizes — the fill is drawn exactly to the cell box, no
 * matter the fallback font.
 */
function blockGlyphBackground(codepoint: number, color: string): string | null {
    const lower = (pct: number) => `linear-gradient(to top, ${color} ${pct}%, transparent ${pct}%)`
    const left  = (pct: number) => `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`
    switch (codepoint) {
        // Lower partial blocks (▁▂▃▄▅▆▇)
        case 0x2581: return lower(12.5)   // ▁
        case 0x2582: return lower(25)     // ▂
        case 0x2583: return lower(37.5)   // ▃
        case 0x2584: return lower(50)     // ▄
        case 0x2585: return lower(62.5)   // ▅
        case 0x2586: return lower(75)     // ▆
        case 0x2587: return lower(87.5)   // ▇
        case 0x2588: return `linear-gradient(${color}, ${color})`  // █
        // Left partial blocks (▉▊▋▌▍▎▏)
        case 0x2589: return left(87.5)    // ▉
        case 0x258A: return left(75)      // ▊
        case 0x258B: return left(62.5)    // ▋
        case 0x258C: return left(50)      // ▌
        case 0x258D: return left(37.5)    // ▍
        case 0x258E: return left(25)      // ▎
        case 0x258F: return left(12.5)    // ▏
        // Right half and upper/right eighths (▐ ▔ ▕)
        case 0x2590: return `linear-gradient(to left, ${color} 50%, transparent 50%)`    // ▐
        case 0x2594: return `linear-gradient(to bottom, ${color} 12.5%, transparent 12.5%)` // ▔
        case 0x2595: return `linear-gradient(to left, ${color} 12.5%, transparent 12.5%)`   // ▕
        case 0x2580: return `linear-gradient(to bottom, ${color} 50%, transparent 50%)`  // ▀
        // Quadrants (single) — layered gradients positioned via background-position/size
        case 0x2596: return quadrant(color, false, false, true, false)   // ▖ lower-left
        case 0x2597: return quadrant(color, false, false, false, true)   // ▗ lower-right
        case 0x2598: return quadrant(color, true, false, false, false)   // ▘ upper-left
        case 0x259D: return quadrant(color, false, true, false, false)   // ▝ upper-right
        // Three-quadrant L shapes
        case 0x2599: return quadrant(color, true, false, true, true)     // ▙ TL+BL+BR
        case 0x259B: return quadrant(color, true, true, true, false)     // ▛ TL+TR+BL
        case 0x259C: return quadrant(color, true, true, false, true)     // ▜ TL+TR+BR
        case 0x259F: return quadrant(color, false, true, true, true)     // ▟ TR+BL+BR
        // Diagonal pairs
        case 0x259A: return quadrant(color, true, false, false, true)    // ▚ TL+BR
        case 0x259E: return quadrant(color, false, true, true, false)    // ▞ TR+BL
        // Shading blocks (approximated via opacity on a solid fill)
        case 0x2591: return `linear-gradient(${color}, ${color})`  // ░ (see opacity handling below)
        case 0x2592: return `linear-gradient(${color}, ${color})`  // ▒
        case 0x2593: return `linear-gradient(${color}, ${color})`  // ▓
    }
    return null
}

/**
 * Build a multi-stop background for the four cell quadrants. Each quadrant
 * is a 50%x50% rectangle in one corner; passing `true` fills that quadrant.
 */
function quadrant(color: string, tl: boolean, tr: boolean, bl: boolean, br: boolean): string {
    const layers: string[] = []
    // Each layer: linear-gradient solid-or-transparent + background-position/size
    // Simpler approach: four overlapping linear-gradients confined to corners
    // via background-size and background-position.
    const add = (fill: boolean, bgPos: string) => {
        if (fill) {
            layers.push(`linear-gradient(${color}, ${color}) ${bgPos} / 50% 50% no-repeat`)
        }
    }
    add(tl, 'top left')
    add(tr, 'top right')
    add(bl, 'bottom left')
    add(br, 'bottom right')
    return layers.join(', ')
}

/** Opacity for shading blocks when rendered via gradient. */
function blockGlyphOpacity(codepoint: number): number | null {
    switch (codepoint) {
        case 0x2591: return 0.25  // ░
        case 0x2592: return 0.5   // ▒
        case 0x2593: return 0.75  // ▓
    }
    return null
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
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontSize: 14,
    lineHeight: 1.2,
    foreground: '#cccccc',
    background: '#000000',
}

/**
 * Install the grid stylesheet once per document. Rows are direct children
 * of the marked container; cells are direct children of rows. Common
 * positional styles live here so the renderer only emits inline styles for
 * per-cell varying values (left, width, height, colour, bg, attr flags).
 */
let gridStylesInstalled: WeakSet<Document> | null = null
const GRID_STYLES = `
[data-svt-grid] > div {
    position: absolute;
    left: 0;
    right: 0;
    height: 1em;
    line-height: 1em;
}
[data-svt-grid] > div > div {
    position: absolute;
    top: 0;
    height: 1em;
    line-height: 1em;
    text-align: center;
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
        // Height comes from the stylesheet (1em); only `top` is per-row.
        const lineHeight = this.lineHeightPx()
        for (let r = 0; r < this.terminal.rows; r++) {
            const rowEl = document.createElement('div')
            rowEl.style.top = `${r * lineHeight}px`
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
    private createCell(cell: Cell, col: number, charWidth: number, _lineHeight: number): HTMLElement {
        const el = document.createElement('div')
        const style = el.style
        style.left = `${col * charWidth}px`
        style.width = `${charWidth}px`

        const fg = this.resolveColor(cell.fg, true)
        const bg = this.resolveColor(cell.bg, false)
        const isInverse = (cell.attrs & Attr.Inverse) !== 0
        const effectiveFg = isInverse ? (bg || this.options.background) : fg
        const effectiveBg = isInverse ? (fg || this.options.foreground) : bg

        // Block-element characters get a CSS gradient background painted in
        // the cell's foreground colour, bypassing font rasterisation so the
        // shape is exactly cell-sized. The character stays in the DOM (with
        // transparent colour) so it's still selectable/copyable.
        const cp = cell.char.codePointAt(0) ?? 0
        const fgForBlock = effectiveFg || this.options.foreground
        const blockBg = blockGlyphBackground(cp, fgForBlock)

        if (blockBg) {
            style.color = 'transparent'
            // Use `background` shorthand so the block-glyph string can carry
            // per-layer position/size/repeat (needed for quadrant gradients).
            // Prepend the cell bg colour as the underlying solid layer.
            const bgColor = effectiveBg || 'transparent'
            style.background = `${blockBg}, ${bgColor}`
            const opacity = blockGlyphOpacity(cp)
            if (opacity !== null) style.opacity = String(opacity)
        } else {
            if (effectiveFg) style.color = effectiveFg
            if (effectiveBg) style.backgroundColor = effectiveBg
        }
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
