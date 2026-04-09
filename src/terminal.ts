import { Parser, type ParserEvent } from './parser.js'
import { Grid } from './grid.js'
import { type Cell, type Color, DEFAULT_COLOR, Attr } from './cell.js'

export interface Cursor {
    col: number
    row: number
    visible: boolean
}

export class Terminal {
    readonly cols: number
    readonly rows: number
    private grid: Grid
    private parser: Parser
    private _cursor: Cursor
    private wrapNext = false

    // Current text attributes for new characters
    private curFg: Color = DEFAULT_COLOR
    private curBg: Color = DEFAULT_COLOR
    private curAttrs: number = Attr.None
    private curHyperlink?: string

    // Tab stops (default every 8 columns)
    private tabStops: Set<number>

    constructor(cols: number, rows: number) {
        this.cols = cols
        this.rows = rows
        this.grid = new Grid(cols, rows)
        this._cursor = { col: 0, row: 0, visible: true }
        this.tabStops = new Set()
        for (let i = 8; i < cols; i += 8) {
            this.tabStops.add(i)
        }
        this.scrollBottom = rows - 1
        this.parser = new Parser((event) => this.handleEvent(event))
    }

    get cursor(): Readonly<Cursor> {
        return this._cursor
    }

    write(input: string): void {
        this.parser.feed(input)
    }

    getCell(col: number, row: number): Cell {
        return this.grid.getCell(col, row)
    }

    getRowText(row: number): string {
        return this.grid.getRowText(row)
    }

    private handleEvent(event: ParserEvent): void {
        switch (event.type) {
            case 'print':
                this.print(event.char)
                break
            case 'execute':
                this.execute(event.code)
                break
            case 'csi':
                this.handleCsi(event.params, event.intermediates, event.final)
                break
            case 'esc':
                this.handleEsc(event.intermediates, event.final)
                break
            case 'osc':
                this.handleOsc(event.data)
                break
        }
    }

    private print(char: string): void {
        if (this.wrapNext) {
            this._cursor.col = 0
            this.linefeed()
            this.wrapNext = false
        }

        this.grid.setCell(this._cursor.col, this._cursor.row, {
            char,
            width: 1,
            fg: this.curFg,
            bg: this.curBg,
            attrs: this.curAttrs,
            hyperlink: this.curHyperlink,
        })

        if (this._cursor.col < this.cols - 1) {
            this._cursor.col++
        } else {
            // At right edge — set wrap pending flag
            this.wrapNext = true
        }
    }

    private execute(code: number): void {
        switch (code) {
            case 0x07: // BEL
                break
            case 0x08: // BS
                if (this._cursor.col > 0) this._cursor.col--
                this.wrapNext = false
                break
            case 0x09: // HT
                this.horizontalTab()
                break
            case 0x0a: // LF
            case 0x0b: // VT
            case 0x0c: // FF
                this.linefeed()
                break
            case 0x0d: // CR
                this._cursor.col = 0
                this.wrapNext = false
                break
        }
    }

    private linefeed(): void {
        this.wrapNext = false
        if (this._cursor.row === this.scrollBottom) {
            this.grid.scrollUp(this.scrollTop, this.scrollBottom, 1)
        } else if (this._cursor.row < this.rows - 1) {
            this._cursor.row++
        }
    }

    private horizontalTab(): void {
        // Advance to next tab stop
        for (let col = this._cursor.col + 1; col < this.cols; col++) {
            if (this.tabStops.has(col) || col === this.cols - 1) {
                this._cursor.col = col
                this.wrapNext = false
                return
            }
        }
    }

    // Saved cursor state (DECSC/DECRC)
    private savedCursor: { col: number; row: number } = { col: 0, row: 0 }

    // Scroll region (DECSTBM) — 0-based, inclusive
    private scrollTop = 0
    private scrollBottom: number

    // Alternate screen buffer
    private altGrid: Grid | null = null
    private isAltScreen = false

    // Private modes
    private _autoWrap = true
    private _applicationCursor = false
    private _bracketedPaste = false
    private _sgrMouse = false
    private _mouseTracking: 'none' | 'x10' | 'normal' | 'button' | 'any' = 'none'

    get mouseMode(): string { return this._mouseTracking }
    get sgrMouse(): boolean { return this._sgrMouse }
    get bracketedPaste(): boolean { return this._bracketedPaste }
    get applicationCursor(): boolean { return this._applicationCursor }
    get autoWrap(): boolean { return this._autoWrap }

    private handleCsi(params: number[], intermediates: string, final: string): void {
        if (intermediates === '?') {
            this.handlePrivateMode(params, final)
            return
        }
        if (intermediates !== '') return

        const p0 = params[0] ?? 0
        const p1 = params[1] ?? 0

        switch (final) {
            case 'm':
                this.handleSgr(params)
                break
            // Cursor movement
            case 'A': // CUU — cursor up
                this._cursor.row = Math.max(0, this._cursor.row - Math.max(1, p0))
                this.wrapNext = false
                break
            case 'B': // CUD — cursor down
                this._cursor.row = Math.min(this.rows - 1, this._cursor.row + Math.max(1, p0))
                this.wrapNext = false
                break
            case 'C': // CUF — cursor forward
                this._cursor.col = Math.min(this.cols - 1, this._cursor.col + Math.max(1, p0))
                this.wrapNext = false
                break
            case 'D': // CUB — cursor back
                this._cursor.col = Math.max(0, this._cursor.col - Math.max(1, p0))
                this.wrapNext = false
                break
            case 'H': // CUP — cursor position
            case 'f': // HVP — same as CUP
                this._cursor.row = Math.min(this.rows - 1, Math.max(0, (p0 || 1) - 1))
                this._cursor.col = Math.min(this.cols - 1, Math.max(0, (p1 || 1) - 1))
                this.wrapNext = false
                break
            case 'G': // CHA — cursor horizontal absolute
                this._cursor.col = Math.min(this.cols - 1, Math.max(0, (p0 || 1) - 1))
                this.wrapNext = false
                break
            case 'd': // VPA — vertical position absolute
                this._cursor.row = Math.min(this.rows - 1, Math.max(0, (p0 || 1) - 1))
                this.wrapNext = false
                break
            // Erase
            case 'J': // ED — erase display
                this.eraseDisplay(p0)
                break
            case 'K': // EL — erase line
                this.eraseLine(p0)
                break
            case 'X': // ECH — erase characters
                this.eraseCharacters(Math.max(1, p0))
                break
            // Insert/delete
            case 'L': // IL — insert lines
                this.insertLines(Math.max(1, p0))
                break
            case 'M': // DL — delete lines
                this.deleteLines(Math.max(1, p0))
                break
            case '@': // ICH — insert characters
                this.insertCharacters(Math.max(1, p0))
                break
            case 'P': // DCH — delete characters
                this.deleteCharacters(Math.max(1, p0))
                break
            // Scroll
            case 'S': // SU — scroll up
                this.grid.scrollUp(this.scrollTop, this.scrollBottom, Math.max(1, p0))
                break
            case 'T': // SD — scroll down
                this.grid.scrollDown(this.scrollTop, this.scrollBottom, Math.max(1, p0))
                break
            // Scroll region
            case 'r': // DECSTBM — set top and bottom margins
                this.scrollTop = Math.max(0, (p0 || 1) - 1)
                this.scrollBottom = Math.min(this.rows - 1, (p1 || this.rows) - 1)
                this._cursor.col = 0
                this._cursor.row = 0
                this.wrapNext = false
                break
        }
    }

    private insertLines(count: number): void {
        const bottom = this.scrollBottom
        for (let i = 0; i < count; i++) {
            this.grid.scrollDown(this._cursor.row, bottom, 1)
        }
    }

    private deleteLines(count: number): void {
        const bottom = this.scrollBottom
        for (let i = 0; i < count; i++) {
            this.grid.scrollUp(this._cursor.row, bottom, 1)
        }
    }

    private insertCharacters(count: number): void {
        const row = this._cursor.row
        const col = this._cursor.col
        // Shift characters right, filling with blanks
        for (let c = this.cols - 1; c >= col + count; c--) {
            const src = this.grid.getCell(c - count, row)
            this.grid.setCell(c, row, {
                char: src.char, width: src.width,
                fg: src.fg, bg: src.bg, attrs: src.attrs,
                hyperlink: src.hyperlink,
            })
        }
        this.grid.clearRange(row, col, Math.min(col + count, this.cols))
    }

    private deleteCharacters(count: number): void {
        const row = this._cursor.row
        const col = this._cursor.col
        // Shift characters left, filling end with blanks
        for (let c = col; c < this.cols - count; c++) {
            const src = this.grid.getCell(c + count, row)
            this.grid.setCell(c, row, {
                char: src.char, width: src.width,
                fg: src.fg, bg: src.bg, attrs: src.attrs,
                hyperlink: src.hyperlink,
            })
        }
        this.grid.clearRange(row, Math.max(col, this.cols - count), this.cols)
    }

    private eraseDisplay(mode: number): void {
        switch (mode) {
            case 0: // cursor to end
                this.grid.clearRange(this._cursor.row, this._cursor.col, this.cols)
                for (let r = this._cursor.row + 1; r < this.rows; r++) {
                    this.grid.clearRow(r)
                }
                break
            case 1: // start to cursor
                for (let r = 0; r < this._cursor.row; r++) {
                    this.grid.clearRow(r)
                }
                this.grid.clearRange(this._cursor.row, 0, this._cursor.col + 1)
                break
            case 2: // entire display
            case 3: // entire display + scrollback
                for (let r = 0; r < this.rows; r++) {
                    this.grid.clearRow(r)
                }
                break
        }
    }

    private eraseLine(mode: number): void {
        switch (mode) {
            case 0: // cursor to end
                this.grid.clearRange(this._cursor.row, this._cursor.col, this.cols)
                break
            case 1: // start to cursor
                this.grid.clearRange(this._cursor.row, 0, this._cursor.col + 1)
                break
            case 2: // entire line
                this.grid.clearRow(this._cursor.row)
                break
        }
    }

    private eraseCharacters(count: number): void {
        this.grid.clearRange(this._cursor.row, this._cursor.col, this._cursor.col + count)
    }

    private handlePrivateMode(params: number[], final: string): void {
        const set = final === 'h'
        const reset = final === 'l'
        if (!set && !reset) return

        for (const p of params) {
            switch (p) {
                case 1: // DECCKM — application cursor keys
                    this._applicationCursor = set
                    break
                case 7: // DECAWM — auto-wrap
                    this._autoWrap = set
                    break
                case 25: // DECTCEM — cursor visibility
                    this._cursor.visible = set
                    break
                case 9: // X10 mouse
                    this._mouseTracking = set ? 'x10' : 'none'
                    break
                case 1000: // Normal mouse tracking
                    if (set) this._mouseTracking = 'normal'
                    else if (this._mouseTracking === 'normal') this._mouseTracking = 'none'
                    break
                case 1002: // Button-event tracking
                    if (set) this._mouseTracking = 'button'
                    else if (this._mouseTracking === 'button') this._mouseTracking = 'normal'
                    break
                case 1003: // Any-event tracking
                    if (set) this._mouseTracking = 'any'
                    else if (this._mouseTracking === 'any') {
                        // Fall back to whatever was set before
                        this._mouseTracking = 'normal'
                    }
                    break
                case 1006: // SGR mouse mode
                    this._sgrMouse = set
                    break
                case 1049: // Alternate screen buffer
                    if (set) this.enterAltScreen()
                    else this.leaveAltScreen()
                    break
                case 2004: // Bracketed paste
                    this._bracketedPaste = set
                    break
                case 2026: // Synchronized output — track but no-op
                    break
            }
        }
    }

    private enterAltScreen(): void {
        if (this.isAltScreen) return
        // Save primary grid, create fresh alt grid
        this.altGrid = this.grid
        this.grid = new Grid(this.cols, this.rows)
        this.isAltScreen = true
        this.savedCursor = { col: this._cursor.col, row: this._cursor.row }
        this._cursor.col = 0
        this._cursor.row = 0
        this.wrapNext = false
    }

    private leaveAltScreen(): void {
        if (!this.isAltScreen || !this.altGrid) return
        this.grid = this.altGrid
        this.altGrid = null
        this.isAltScreen = false
        this._cursor.col = this.savedCursor.col
        this._cursor.row = this.savedCursor.row
        this.wrapNext = false
    }

    private handleSgr(params: number[]): void {
        if (params.length === 0) params = [0]

        for (let i = 0; i < params.length; i++) {
            const p = params[i]
            switch (p) {
                case 0:
                    this.curAttrs = Attr.None
                    this.curFg = DEFAULT_COLOR
                    this.curBg = DEFAULT_COLOR
                    this.curHyperlink = undefined
                    break
                case 1: this.curAttrs |= Attr.Bold; break
                case 2: this.curAttrs |= Attr.Dim; break
                case 3: this.curAttrs |= Attr.Italic; break
                case 4: this.curAttrs |= Attr.Underline; break
                case 5: this.curAttrs |= Attr.Blink; break
                case 7: this.curAttrs |= Attr.Inverse; break
                case 8: this.curAttrs |= Attr.Invisible; break
                case 9: this.curAttrs |= Attr.Strikethrough; break
                case 22: this.curAttrs &= ~(Attr.Bold | Attr.Dim); break
                case 23: this.curAttrs &= ~Attr.Italic; break
                case 24: this.curAttrs &= ~Attr.Underline; break
                case 25: this.curAttrs &= ~Attr.Blink; break
                case 27: this.curAttrs &= ~Attr.Inverse; break
                case 28: this.curAttrs &= ~Attr.Invisible; break
                case 29: this.curAttrs &= ~Attr.Strikethrough; break
                // Foreground colors (ANSI 8)
                case 30: case 31: case 32: case 33:
                case 34: case 35: case 36: case 37:
                    this.curFg = { type: 'indexed', index: p - 30 }
                    break
                case 39: this.curFg = DEFAULT_COLOR; break
                // Background colors (ANSI 8)
                case 40: case 41: case 42: case 43:
                case 44: case 45: case 46: case 47:
                    this.curBg = { type: 'indexed', index: p - 40 }
                    break
                case 49: this.curBg = DEFAULT_COLOR; break
                // Bright foreground (ANSI 16)
                case 90: case 91: case 92: case 93:
                case 94: case 95: case 96: case 97:
                    this.curFg = { type: 'indexed', index: p - 90 + 8 }
                    break
                // Bright background (ANSI 16)
                case 100: case 101: case 102: case 103:
                case 104: case 105: case 106: case 107:
                    this.curBg = { type: 'indexed', index: p - 100 + 8 }
                    break
                // Extended color: 256-color and truecolor
                case 38:
                    i = this.parseExtendedColor(params, i, true)
                    break
                case 48:
                    i = this.parseExtendedColor(params, i, false)
                    break
            }
        }
    }

    private parseExtendedColor(params: number[], i: number, isFg: boolean): number {
        if (i + 1 >= params.length) return i
        const mode = params[i + 1]
        if (mode === 5 && i + 2 < params.length) {
            // 256-color: 38;5;n or 48;5;n
            const color: Color = { type: 'indexed', index: params[i + 2] }
            if (isFg) this.curFg = color; else this.curBg = color
            return i + 2
        } else if (mode === 2 && i + 4 < params.length) {
            // Truecolor: 38;2;r;g;b or 48;2;r;g;b
            const color: Color = { type: 'rgb', r: params[i + 2], g: params[i + 3], b: params[i + 4] }
            if (isFg) this.curFg = color; else this.curBg = color
            return i + 4
        }
        return i
    }

    private handleEsc(intermediates: string, final: string): void {
        if (intermediates === '') {
            switch (final) {
                case '7': // DECSC — save cursor
                    this.savedCursor = { col: this._cursor.col, row: this._cursor.row }
                    break
                case '8': // DECRC — restore cursor
                    this._cursor.col = this.savedCursor.col
                    this._cursor.row = this.savedCursor.row
                    this.wrapNext = false
                    break
                case 'M': // RI — reverse index
                    if (this._cursor.row === this.scrollTop) {
                        this.grid.scrollDown(this.scrollTop, this.scrollBottom, 1)
                    } else if (this._cursor.row > 0) {
                        this._cursor.row--
                    }
                    break
            }
        }
    }

    private handleOsc(data: string): void {
        // Will be implemented in later slices
    }
}
