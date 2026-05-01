<script lang="ts">
    import { onMount } from 'svelte'
    import { Terminal } from './terminal.js'
    import type { Cell as Vt100Cell, Color } from './cell.js'
    import { Attr } from './cell.js'
    import type { TerminalStream } from './stream.js'

    let {
        stream,
        cols = 80,
        rows = 24,
    }: {
        stream: TerminalStream
        cols?: number
        rows?: number
    } = $props()

    const terminal = new Terminal(cols, rows)
    let region = $state<any>(undefined)

    onMount(() => {
        const unsubOutput = stream.onOutput((bytes) => terminal.write(bytes))
        // Don't seed stream.resize from prop defaults here — the region's
        // first paint already fires a layout-driven resize with the real
        // allocated cell grid (via SvtRegionNode.notifyAllocatedSize ->
        // handleRegionResize). svelterm's paint microtask runs BEFORE
        // Svelte's onMount, so seeding here would clobber the correct size
        // with the 80×24 prop default and the embedded kernel would see
        // the wrong dimensions until something else triggered a resize.

        // Register an input sink so the host iframe (or whoever drives
        // the outer terminal) can forward typed keystrokes and mouse
        // events straight to the embedded shell. The host calls
        // globalThis.__svtTerminalInputSink(seq) with already-translated
        // ANSI byte sequences (Enter -> "\r", arrow keys -> CSI sequences,
        // SGR mouse reports, etc.) and we shovel them at the stream.
        const encoder = new TextEncoder()
        const previousSink = (globalThis as any).__svtTerminalInputSink
        ;(globalThis as any).__svtTerminalInputSink = (data: string) => {
            stream.write(encoder.encode(data))
        }

        return () => {
            unsubOutput()
            ;(globalThis as any).__svtTerminalInputSink = previousSink
        }
    })

    $effect(() => {
        if (!region) return
        region.setCellSource((col: number, row: number) =>
            cellToSvelterm(terminal.getCell(col, row))
        )
        // Mirror the embedded terminal's cursor onto the region so the
        // outer terminal can position + show it after each repaint.
        // Otherwise the user can't see where typed bytes will land.
        const syncCursor = () => {
            const c = terminal.cursor
            region.setCursor({ col: c.col, row: c.row, visible: c.visible })
        }
        syncCursor()
        const previous = terminal.onChange
        terminal.onChange = () => {
            syncCursor()
            region.markDirty()
            previous?.()
        }
        return () => {
            terminal.onChange = previous
            region.setCursor(null)
        }
    })

    /** Capture the SvtRegionNode reference; bind:this isn't usable in customRenderer mode. */
    function captureRegion(node: any) {
        region = node
    }

    function handleRegionResize(event: { data: { cols: number; rows: number } }) {
        const { cols: newCols, rows: newRows } = event.data
        if (newCols === terminal.cols && newRows === terminal.rows) return
        terminal.resize(newCols, newRows)
        stream.resize(newCols, newRows)
    }

    /**
     * Convert a vt100 Cell (Color tagged unions, attrs bitfield) into the
     * shape svelterm's CellBuffer expects (string colours, boolean attr
     * flags). Returned cells flow through `<svt-region>`'s cell source.
     */
    function cellToSvelterm(cell: Vt100Cell): {
        char: string
        fg: string
        bg: string
        bold: boolean
        italic: boolean
        underline: boolean
        strikethrough: boolean
        dim: boolean
        inverse: boolean
        hyperlink?: string
    } {
        return {
            char: cell.char,
            fg: colorToString(cell.fg),
            bg: colorToString(cell.bg),
            bold: (cell.attrs & Attr.Bold) !== 0,
            italic: (cell.attrs & Attr.Italic) !== 0,
            underline: (cell.attrs & Attr.Underline) !== 0,
            strikethrough: (cell.attrs & Attr.Strikethrough) !== 0,
            dim: (cell.attrs & Attr.Dim) !== 0,
            inverse: (cell.attrs & Attr.Inverse) !== 0,
            hyperlink: cell.hyperlink,
        }
    }

    function colorToString(color: Color): string {
        if (color.type === 'default') return 'default'
        if (color.type === 'rgb') return `rgb(${color.r},${color.g},${color.b})`
        return indexedToString(color.index)
    }

    const ANSI_16 = [
        'black', 'red', 'green', 'yellow',
        'blue', 'magenta', 'cyan', 'white',
        'brightblack', 'brightred', 'brightgreen', 'brightyellow',
        'brightblue', 'brightmagenta', 'brightcyan', 'brightwhite',
    ]

    function indexedToString(index: number): string {
        if (index < 16) return ANSI_16[index]
        if (index < 232) {
            const n = index - 16
            const b = (n % 6) * 51
            const g = (Math.floor(n / 6) % 6) * 51
            const r = Math.floor(n / 36) * 51
            return `rgb(${r},${g},${b})`
        }
        const v = (index - 232) * 10 + 8
        return `rgb(${v},${v},${v})`
    }
</script>

<svt-region use:captureRegion onresize={handleRegionResize}></svt-region>
