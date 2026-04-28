export type Color =
    | { type: 'default' }
    | { type: 'indexed'; index: number }
    | { type: 'rgb'; r: number; g: number; b: number }

export const DEFAULT_COLOR: Color = { type: 'default' }

export enum Attr {
    None        = 0,
    Bold        = 1 << 0,
    Dim         = 1 << 1,
    Italic      = 1 << 2,
    Underline   = 1 << 3,
    Blink       = 1 << 4,
    Inverse     = 1 << 5,
    Invisible   = 1 << 6,
    Strikethrough = 1 << 7,
}

export interface Cell {
    char: string
    width: number
    fg: Color
    bg: Color
    attrs: number
    hyperlink?: string
}

export function createEmptyCell(): Cell {
    return {
        char: ' ',
        width: 1,
        fg: DEFAULT_COLOR,
        bg: DEFAULT_COLOR,
        attrs: Attr.None,
    }
}

export function resetCell(cell: Cell): void {
    cell.char = ' '
    cell.width = 1
    cell.fg = DEFAULT_COLOR
    cell.bg = DEFAULT_COLOR
    cell.attrs = Attr.None
    cell.hyperlink = undefined
}
