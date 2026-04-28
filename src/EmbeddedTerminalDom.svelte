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
        fontFamily = "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        fontSize = 14,
        lineHeight = 1.2,
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

    const terminal = new Terminal(cols, rows)
    let container: HTMLElement | undefined = $state()

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
        const unsubOutput = stream.onOutput((bytes) => terminal.write(bytes))
        stream.resize(cols, rows)
        container?.focus()

        // Track container size and convert to a cell grid so the embedded
        // shell sees SIGWINCH whenever the layout changes.
        const charWidth = measureCharWidth(fontFamily, fontSize)
        const lineHeightPx = Math.round(fontSize * lineHeight)
        const observer = new ResizeObserver((entries) => {
            if (charWidth <= 0 || lineHeightPx <= 0) return
            for (const entry of entries) {
                const newCols = Math.max(1, Math.floor(entry.contentRect.width / charWidth))
                const newRows = Math.max(1, Math.floor(entry.contentRect.height / lineHeightPx))
                if (newCols === terminal.cols && newRows === terminal.rows) continue
                terminal.resize(newCols, newRows)
                stream.resize(newCols, newRows)
            }
        })
        if (container) observer.observe(container)

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
        {fontFamily}
        {fontSize}
        {lineHeight}
        {foreground}
        {background}
    />
</div>

<style>
    .embedded-terminal {
        width: 100%;
        height: 100%;
        outline: none;
    }
</style>
