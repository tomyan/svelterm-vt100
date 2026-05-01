<!--
    EmbeddedTerminalDom — DOM-rendered vt100 grid for v86-style streams.

    ## Sizing

    `font-size` and `font-family` are read from the rendered element's
    *computed style*, not props. The "API" for sizing is plain CSS — set
    `font-size` on (or above) the embedded terminal and the cell grid
    follows. Resize observer re-reads on every layout change so anything
    that affects computed font-size (theme switch, breakpoint, container
    query, zoom) flows through automatically.

    ## Font-family pitfalls

    Two non-obvious traps to avoid when authoring the host's font-family:

    1. **Subsetted webfonts.** `@fontsource/jetbrains-mono` and most CDN
       JBM packages subset out U+2500–U+257F (box-drawing). Browsers fall
       through to the next family in the chain for those characters, so
       your terminal's `─ │ ┌ ┐ └ ┘` come from somewhere else than your
       primary font.

    2. **Symbols-only fonts (Nerd Fonts) early in the chain.** A "Nerd
       Fonts symbols" font like `@azurity/pure-nerd-font` covers the
       Nerd-Font icon range *and* claims various other Unicode ranges its
       authors swept in — including box-drawing. Its glyphs there are
       designed shorter than the cell, so when the browser uses it for `│`
       you get visible vertical gaps between rows.

    Recommended order for a host that wants ligatures *and* Nerd-Font icons:

    ```css
    body {
        font-family:
            'JetBrains Mono',           /* primary — code/text + ligatures */
            ui-monospace, 'SF Mono',    /* system mono — fills box-drawing */
            Menlo, monospace,           /* deeper fallback */
            'Pure Nerd Font';           /* last — only Nerd-icon glyphs */
    }
    ```

    ## Line-height

    Default `lineHeight = 1.0`. Anything higher leaves a leading gap that
    vertical box-drawing characters can't bridge (their glyphs are em-tall
    in fonts that get this right; tighter than em in fonts that don't).
    Override only if you don't care about box-drawing continuity.
-->
<script lang="ts">
    import { onMount } from 'svelte'
    import { Terminal } from './terminal.js'
    import { keyEventToBytes } from './input.js'
    import type { TerminalStream } from './stream.js'
    import TerminalView from './TerminalView.svelte'

    let {
        stream,
        cols = 80,
        rows = 24,
        class: className = '',
        // 1.0 keeps box-drawing characters connecting cleanly across rows.
        // Anything higher leaves a leading gap that vertical characters
        // (│ ║ ┃) can't bridge — JetBrains Mono's glyphs don't extend past
        // their em despite generous-looking metrics, and we deliberately
        // don't paint these characters as gradients.
        lineHeight = 1.0,
        // Defaults match svelterm-site's TerminalShell so the browser-mode
        // and terminal-mode previews look the same side-by-side. Host can
        // override via CSS vars on .embedded-terminal or via prop.
        foreground = 'var(--svt-terminal-fg, #c9d1d9)',
        background = 'var(--svt-terminal-bg, #0d1117)',
    }: {
        stream: TerminalStream
        cols?: number
        rows?: number
        class?: string
        lineHeight?: number
        foreground?: string
        background?: string
    } = $props()

    const terminal = new Terminal(cols, rows)
    let container: HTMLElement | undefined = $state()
    // Cell font picked up from the container's computed style — the "API"
    // for sizing is just CSS: a host writes `.embedded-terminal { font-size:
    // 13px }` (or sets it on any ancestor) and cells follow.
    let computedFontSize = $state(14)
    let computedFontFamily = $state('monospace')

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

    function readFont(el: HTMLElement) {
        const cs = getComputedStyle(el)
        computedFontSize = parseFloat(cs.fontSize)
        computedFontFamily = cs.fontFamily
    }

    onMount(() => {
        if (!container) return
        readFont(container)

        const unsubOutput = stream.onOutput((bytes) => terminal.write(bytes))
        stream.resize(cols, rows)
        container.focus()

        const observer = new ResizeObserver((entries) => {
            // Re-read computed font on every resize so a host that switches
            // font-size (theme/breakpoint/zoom) flows through immediately.
            if (container) readFont(container)
            const cw = measureCharWidth(computedFontFamily, computedFontSize)
            const lh = Math.round(computedFontSize * lineHeight)
            if (cw <= 0 || lh <= 0) return
            for (const entry of entries) {
                const newCols = Math.max(1, Math.floor(entry.contentRect.width / cw))
                const newRows = Math.max(1, Math.floor(entry.contentRect.height / lh))
                if (newCols === terminal.cols && newRows === terminal.rows) continue
                terminal.resize(newCols, newRows)
                stream.resize(newCols, newRows)
            }
        })
        observer.observe(container)

        return () => {
            unsubOutput()
            observer.disconnect()
        }
    })

    function handleKeydown(event: KeyboardEvent) {
        const bytes = keyEventToBytes(event)
        if (bytes.length === 0) return
        event.preventDefault()
        stream.write(bytes)
    }
</script>

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
        fontFamily={computedFontFamily}
        fontSize={computedFontSize}
        {lineHeight}
        {foreground}
        {background}
    />
</div>

<style>
    .embedded-terminal {
        color-scheme: light dark;
        width: 100%;
        height: 100%;
        outline: none;
        --svt-terminal-fg: light-dark(#1a1a2e, #c9d1d9);
        --svt-terminal-bg: light-dark(#ffffff, #0d1117);
    }
    :global(:root[data-theme="light"]) .embedded-terminal { color-scheme: light; }
    :global(:root[data-theme="dark"])  .embedded-terminal { color-scheme: dark; }
</style>
