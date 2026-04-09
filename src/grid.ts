import { type Cell, createEmptyCell, resetCell } from './cell.js'

export class Grid {
    readonly cols: number
    readonly rows: number
    private cells: Cell[][]

    constructor(cols: number, rows: number) {
        this.cols = cols
        this.rows = rows
        this.cells = Grid.createRows(cols, rows)
    }

    getCell(col: number, row: number): Cell {
        return this.cells[row][col]
    }

    setCell(col: number, row: number, cell: Partial<Cell>): void {
        const existing = this.cells[row][col]
        if (cell.char !== undefined) existing.char = cell.char
        if (cell.width !== undefined) existing.width = cell.width
        if (cell.fg !== undefined) existing.fg = cell.fg
        if (cell.bg !== undefined) existing.bg = cell.bg
        if (cell.attrs !== undefined) existing.attrs = cell.attrs
        if (cell.hyperlink !== undefined) existing.hyperlink = cell.hyperlink
    }

    clearRow(row: number): void {
        for (let col = 0; col < this.cols; col++) {
            resetCell(this.cells[row][col])
        }
    }

    clearRange(row: number, startCol: number, endCol: number): void {
        for (let col = startCol; col < endCol && col < this.cols; col++) {
            resetCell(this.cells[row][col])
        }
    }

    scrollUp(top: number, bottom: number, count: number): void {
        for (let i = 0; i < count; i++) {
            const removed = this.cells.splice(top, 1)[0]
            // Clear the removed row and reinsert at bottom
            for (const cell of removed) resetCell(cell)
            this.cells.splice(bottom, 0, removed)
        }
    }

    scrollDown(top: number, bottom: number, count: number): void {
        for (let i = 0; i < count; i++) {
            const removed = this.cells.splice(bottom, 1)[0]
            for (const cell of removed) resetCell(cell)
            this.cells.splice(top, 0, removed)
        }
    }

    getRowText(row: number): string {
        return this.cells[row].map(c => c.char).join('')
    }

    private static createRows(cols: number, rows: number): Cell[][] {
        const grid: Cell[][] = []
        for (let r = 0; r < rows; r++) {
            const row: Cell[] = []
            for (let c = 0; c < cols; c++) {
                row.push(createEmptyCell())
            }
            grid.push(row)
        }
        return grid
    }
}
