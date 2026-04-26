<script lang="ts">
    import { onMount } from 'svelte'
    import type { Terminal } from './terminal.js'
    import type { Cell, Color } from './cell.js'
    import { Attr } from './cell.js'
    import { blockGlyphBackground, blockGlyphOpacity } from './block-glyphs.js'

    let {
        terminal,
        fontFamily = "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        fontSize = 14,
        lineHeight = 1.2,
        foreground = '#cccccc',
        background = '#000000',
        class: className = '',
    }: {
        terminal: Terminal
        fontFamily?: string
        fontSize?: number
        lineHeight?: number
        foreground?: string
        background?: string
        class?: string
    } = $props()

    // Write-only marker: replaced (not mutated) on each terminal change so
    // deriveds re-run. A read-then-write counter (e.g. `version++`) would
    // capture `version` as a dep of whatever reactive scope is calling
    // `terminal.write` — and the same handler's write would then re-fire
    // that caller, causing an infinite loop.
    let changeMarker = $state({})
    let charWidth = $state(0)
    let container: HTMLElement | undefined = $state()

    const lineHeightPx = $derived(Math.round(fontSize * lineHeight))

    function measureCharWidth(family: string, size: number): number {
        const span = document.createElement('span')
        span.style.fontFamily = family
        span.style.fontSize = `${size}px`
        span.style.position = 'absolute'
        span.style.visibility = 'hidden'
        span.style.whiteSpace = 'pre'
        span.textContent = 'M'
        document.body.appendChild(span)
        const w = span.getBoundingClientRect().width
        document.body.removeChild(span)
        return w
    }

    onMount(() => {
        // Measure a single character's width so cells can be positioned
        // precisely. Fractional character widths would otherwise cause
        // subpixel drift between columns.
        charWidth = measureCharWidth(fontFamily, fontSize)

        const previous = terminal.onChange
        terminal.onChange = () => {
            changeMarker = {}
            previous?.()
        }
        return () => {
            terminal.onChange = previous
        }
    })

    const ANSI_16 = [
        '#000000', '#aa0000', '#00aa00', '#aa5500',
        '#0000aa', '#aa00aa', '#00aaaa', '#aaaaaa',
        '#555555', '#ff5555', '#55ff55', '#ffff55',
        '#5555ff', '#ff55ff', '#55ffff', '#ffffff',
    ]

    function indexedHex(index: number): string {
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

    function resolveColor(color: Color): string | null {
        if (color.type === 'default') return null
        if (color.type === 'rgb') return `rgb(${color.r},${color.g},${color.b})`
        return indexedHex(color.index)
    }

    const rows = $derived.by(() => {
        // Subscribe to the change marker so the derivation re-runs on terminal updates.
        void changeMarker
        const result: Cell[][] = []
        for (let r = 0; r < terminal.rows; r++) {
            const row: Cell[] = []
            for (let c = 0; c < terminal.cols; c++) {
                // Cells are mutated in place by Terminal; clone so Svelte's
                // keyed {#each} sees a fresh reference each tick.
                const cell = terminal.getCell(c, r)
                row.push({
                    char: cell.char,
                    width: cell.width,
                    fg: cell.fg,
                    bg: cell.bg,
                    attrs: cell.attrs,
                    hyperlink: cell.hyperlink,
                })
            }
            result.push(row)
        }
        return result
    })

    const cursor = $derived.by(() => {
        void changeMarker
        return terminal.cursor
    })

    interface CellRender {
        style: string
        char: string
    }

    function renderCell(cell: Cell): CellRender {
        const parts: string[] = []
        const fg = resolveColor(cell.fg)
        const bg = resolveColor(cell.bg)
        const isInverse = (cell.attrs & Attr.Inverse) !== 0
        const effectiveFg = isInverse ? (bg ?? background) : fg
        const effectiveBg = isInverse ? (fg ?? foreground) : bg

        // Block-element characters render via CSS gradient so they fill the
        // cell exactly, regardless of font rasterisation artefacts at small
        // sizes. The char itself stays in DOM (transparent) for selection.
        const cp = cell.char.codePointAt(0) ?? 0
        const fgForBlock = effectiveFg ?? foreground
        const blockBg = blockGlyphBackground(cp, fgForBlock)

        if (blockBg) {
            parts.push('color:transparent')
            const bgSolid = effectiveBg ?? 'transparent'
            parts.push(`background:${blockBg}, ${bgSolid}`)
            const op = blockGlyphOpacity(cp)
            if (op !== null) parts.push(`opacity:${op}`)
        } else {
            if (effectiveFg) parts.push(`color:${effectiveFg}`)
            if (effectiveBg) parts.push(`background-color:${effectiveBg}`)
        }
        if (cell.attrs & Attr.Bold) parts.push('font-weight:bold')
        if (cell.attrs & Attr.Dim && !(cell.attrs & Attr.Inverse)) parts.push('opacity:0.5')
        if (cell.attrs & Attr.Italic) parts.push('font-style:italic')

        const decorations: string[] = []
        if (cell.attrs & Attr.Underline) decorations.push('underline')
        if (cell.attrs & Attr.Strikethrough) decorations.push('line-through')
        if (decorations.length) parts.push(`text-decoration:${decorations.join(' ')}`)
        if (cell.attrs & Attr.Invisible) parts.push('visibility:hidden')

        return { style: parts.join(';'), char: cell.char }
    }
</script>

<div
    bind:this={container}
    class="terminal-view {className}"
    data-svt-grid
    style:font-family={fontFamily}
    style:font-size="{fontSize}px"
    style:line-height="{lineHeightPx}px"
    style:color={foreground}
    style:background={background}
>
    {#each rows as row, r (r)}
        <div class="row" style:top="{r * lineHeightPx}px">
            {#each row as cell, c (c)}
                {@const rendered = renderCell(cell)}
                <div
                    class="cell"
                    style:left="{c * charWidth}px"
                    style:width="{charWidth}px"
                    style={rendered.style}
                >{rendered.char}</div>
            {/each}
        </div>
    {/each}
    {#if cursor.visible && charWidth > 0}
        <div
            class="cursor"
            style:left="{cursor.col * charWidth}px"
            style:top="{cursor.row * lineHeightPx}px"
            style:width="{charWidth}px"
            style:height="{lineHeightPx}px"
            style:background={foreground}
        ></div>
    {/if}
</div>

<style>
    .terminal-view {
        white-space: pre;
        overflow: hidden;
        position: relative;
        width: 100%;
        height: 100%;
    }
    .row {
        position: absolute;
        left: 0;
        right: 0;
        height: 1em;
        line-height: 1em;
    }
    .cell {
        position: absolute;
        top: 0;
        height: 1em;
        line-height: 1em;
        text-align: center;
    }
    .cursor {
        position: absolute;
        pointer-events: none;
        opacity: 0.5;
    }
</style>
