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
        if (this._cursor.row < this.rows - 1) {
            this._cursor.row++
        } else {
            this.grid.scrollUp(0, this.rows - 1, 1)
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

    // Placeholder for CSI, ESC, OSC — will be filled in slices 3-7
    private handleCsi(params: number[], intermediates: string, final: string): void {
        // Will be implemented in later slices
    }

    private handleEsc(intermediates: string, final: string): void {
        // Will be implemented in later slices
    }

    private handleOsc(data: string): void {
        // Will be implemented in later slices
    }
}
