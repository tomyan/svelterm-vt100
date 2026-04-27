<script lang="ts">
    import { onMount, getContext } from 'svelte'
    import { Terminal } from './terminal.js'
    import type { Cell as Vt100Cell, Color } from './cell.js'
    import { Attr } from './cell.js'
    import { keyEventToBytes } from './input.js'
    import type { TerminalStream } from './stream.js'
    import TerminalView from './TerminalView.svelte'

    let {
        stream,
        cols = 80,
        rows = 24,
        class: className = '',
        fontFamily,
        fontSize,
        lineHeight,
        foreground,
        background,
    }: {
        stream: TerminalStream
        cols?: number
        rows?: number
        class?: string
        fontFamily?: string
        fontSize?: number
        lineHeight?: number
        foreground?: string
        background?: string
    } = $props()

    // Detect render target via context seeded by svelterm's run().
    // Browser-Svelte mounts have no such key; fall back to 'browser'.
    const target =
        getContext<'browser' | 'terminal'>(Symbol.for('@svelterm/target')) ??
        'browser'

    const terminal = new Terminal(cols, rows)
    let region: any = $state(undefined) // SvtRegionNode in svelterm target
    let container: HTMLElement | undefined = $state()

    onMount(() => {
        const unsubOutput = stream.onOutput((bytes) => terminal.write(bytes))
        stream.resize(cols, rows)
        if (target === 'browser') container?.focus()
        return () => {
            unsubOutput()
        }
    })

    // Svelterm path: bridge cell content to the region.
    $effect(() => {
        if (target !== 'terminal' || !region) return
        region.setCellSource((col: number, row: number) =>
            cellToSvelterm(terminal.getCell(col, row))
        )
        const previous = terminal.onChange
        terminal.onChange = () => {
            region.markDirty()
            previous?.()
        }
        return () => {
            terminal.onChange = previous
        }
    })

    function handleRegionResize(event: { data: { cols: number; rows: number } }) {
        const { cols: newCols, rows: newRows } = event.data
        if (newCols === terminal.cols && newRows === terminal.rows) return
        terminal.resize(newCols, newRows)
        stream.resize(newCols, newRows)
    }

    function handleKeydown(event: KeyboardEvent) {
        const bytes = keyEventToBytes(event)
        if (bytes.length === 0) return
        event.preventDefault()
        stream.write(bytes)
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
        hyperlink?: string
    } {
        const isInverse = (cell.attrs & Attr.Inverse) !== 0
        const fgColor = isInverse ? cell.bg : cell.fg
        const bgColor = isInverse ? cell.fg : cell.bg
        return {
            char: cell.char,
            fg: colorToString(fgColor),
            bg: colorToString(bgColor),
            bold: (cell.attrs & Attr.Bold) !== 0,
            italic: (cell.attrs & Attr.Italic) !== 0,
            underline: (cell.attrs & Attr.Underline) !== 0,
            strikethrough: (cell.attrs & Attr.Strikethrough) !== 0,
            dim: (cell.attrs & Attr.Dim) !== 0 && !isInverse,
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

{#if target === 'terminal'}
    <svt-region bind:this={region} onresize={handleRegionResize}></svt-region>
{:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
        bind:this={container}
        class="embedded-terminal {className}"
        tabindex="0"
        role="application"
        onkeydown={handleKeydown}
    >
        <TerminalView
            {terminal}
            {fontFamily}
            {fontSize}
            {lineHeight}
            {foreground}
            {background}
        />
    </div>
{/if}

<style>
    .embedded-terminal {
        width: 100%;
        height: 100%;
        outline: none;
    }
</style>
