<script lang="ts">
    import { onMount } from 'svelte'
    import { TerminalRenderer, type TerminalRendererOptions } from './dom.js'
    import type { Terminal } from './terminal.js'

    let {
        terminal,
        options = {},
        class: className = '',
    }: {
        terminal: Terminal
        options?: TerminalRendererOptions
        class?: string
    } = $props()

    let container: HTMLElement
    let renderer: TerminalRenderer

    onMount(() => {
        renderer = new TerminalRenderer(container, terminal, options)

        return () => {
            renderer.dispose()
        }
    })

    export function scheduleRender(): void {
        renderer?.scheduleRender()
    }

    export function renderNow(): void {
        renderer?.render()
    }
</script>

<div bind:this={container} class="terminal-view {className}"></div>

<style>
    .terminal-view {
        width: 100%;
        height: 100%;
    }
</style>
