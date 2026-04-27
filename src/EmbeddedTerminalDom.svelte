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

    const terminal = new Terminal(cols, rows)
    let container: HTMLElement | undefined = $state()

    onMount(() => {
        const unsubOutput = stream.onOutput((bytes) => terminal.write(bytes))
        stream.resize(cols, rows)
        container?.focus()
        return () => {
            unsubOutput()
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
