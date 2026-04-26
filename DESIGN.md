# @svelterm/vt100 Design

A VT100/VT220/xterm terminal emulator in TypeScript, plus the rendering,
input encoding, stream abstraction, and PTY adapter needed to embed a
terminal stream inside a Svelte / svelterm application.

The package is the single-pane primitive that tmux-style terminal
applications are built on top of. It covers everything from raw bytes to
rendered output, but stops short of composing panes or managing sessions —
those live in the host application.

## Scope

In:
- ANSI byte stream → terminal state machine → cell grid (`Parser`,
  `Terminal`)
- Rendering a cell grid in both browser (DOM) and svelterm (terminal
  output) targets, from one reactive Svelte component (`TerminalView`)
- Encoding browser `KeyboardEvent`s to ANSI input bytes (`keyEventToBytes`)
- A stream interface (`TerminalStream`) for bidirectional byte flow with
  resize coordination
- A composed embedded-terminal primitive (`EmbeddedTerminal`) — one stream
  in, a live terminal view out
- A PTY adapter (`@svelterm/vt100/pty`) that spawns a child process on a
  pseudo-terminal and exposes it as a `TerminalStream`

Out:
- Pane layout, tabs, status bars — tmux-style composition lives in the
  application, using `EmbeddedTerminal` per pane.
- Terminal multiplexer logic (session management, detached sessions,
  shared buffers) — same, belongs above this package.

## Architecture

```
       ┌────────────────────────────────────────────────────────┐
       │                  EmbeddedTerminal                      │
       │                                                        │
       │   TerminalStream ──▶ Terminal ──▶ TerminalView         │
       │       ▲              (state)       (view)              │
       │       │                                                │
       │     KeyboardEvent ─▶ keyEventToBytes ─▶ bytes          │
       │                                                        │
       └────────────────────────────────────────────────────────┘
```

Layers are independently usable. A consumer wanting finer control can drop
`EmbeddedTerminal` and wire `Terminal` + `TerminalView` + their own stream
adapter by hand.

## Layers

### Parser

Byte-level ANSI escape sequence parser. Emits events classifying input into
print, execute, CSI, OSC, DCS, ESC. Follows the VT500-series parser state
machine. Handles UTF-8 decoding, malformed sequences, intermediate bytes,
parameters with defaults and sub-parameters.

### Terminal

Interprets parsed events and updates state:

- Primary and alternate screen buffers
- Cursor position, style, visibility
- Scroll region, origin mode, auto-wrap, insert/replace, character sets
- SGR: fg/bg (default/indexed/RGB), bold/dim/italic/underline/blink/
  inverse/invisible/strikethrough, underline styles, hyperlinks (OSC 8)
- Cursor ops, erase, insert/delete, scroll, tabs, LF/CR/BS
- Alternate screen switching, private modes
- Window title (OSC 0/2), mouse modes, bracketed paste, synchronised
  output

API:

```ts
const term = new Terminal(cols, rows)
term.write(bytes: Uint8Array)        // bytes in from the stream
term.resize(cols, rows)
term.getCell(col, row): Cell
term.cursor                          // { col, row, visible, style }
term.onChange = () => { ... }        // fires after every mutation
term.onResponse = (bytes) => { ... } // terminal → stream (e.g. DSR)
term.onTitleChange = (title) => { ... }
term.onBell = () => { ... }
```

Bytes in, bytes out. No strings at the edge — partial UTF-8 sequences
across writes would break a string boundary.

### Cell grid

```ts
interface Cell {
    char: string
    width: number           // 1 normal, 2 wide (CJK)
    fg: Color
    bg: Color
    attrs: number           // bitflags
    hyperlink?: string
}
type Color =
    | { type: 'default' }
    | { type: 'indexed'; index: number }
    | { type: 'rgb'; r: number; g: number; b: number }
```

Cells are mutated in place. Reactive consumers that key on object
identity (Svelte's `{#each}`) must clone on read.

### Input encoding

`keyEventToBytes(event: KeyInput): Uint8Array` — maps a DOM-like
KeyboardEvent shape to ANSI input bytes. Covers printable chars, Ctrl
combinations, Alt prefixes, arrows, Home/End/Page/Insert/Delete, F1–F12,
and modifier-only events (returns empty).

`KeyInput` is a structural subset of `KeyboardEvent` (`key`, `ctrlKey`,
`altKey`, `shiftKey`, `metaKey`), so DOM events can be passed directly.

### TerminalStream

```ts
interface TerminalStream {
    onOutput(listener: (bytes: Uint8Array) => void): () => void
    write(bytes: Uint8Array): void
    resize(cols: number, rows: number): void
    onClose(listener: () => void): () => void
    close(): void
}
```

A bidirectional byte channel with viewport-size coordination. Not a PTY,
not a process — a stream. Adapters bridge specific sources to this shape:

- `@svelterm/vt100/pty` — spawn a process on a pseudo-terminal (Node + Bun)
- User code — v86 serial port, WebSocket, anything that produces bytes

`resize` is how the far end learns about viewport changes — a PTY calls
`TIOCSWINSZ` and sends `SIGWINCH`; a WebSocket sends a resize message; an
in-process bridge forwards to its peer.

### TerminalView

```svelte
<TerminalView {terminal} foreground="#ccc" background="#000" />
```

Reactive Svelte component that renders a `Terminal`'s cell grid. Subscribes
to `terminal.onChange`, snapshots cells on each tick, renders as `<div>`
rows and `<span>` cells.

Dual-target:
- **Browser**: real DOM, monospace font, inline `color`/`background`/
  `font-weight`/etc. — produces the terminal look.
- **Svelterm target**: svelterm's renderer interprets the same markup —
  divs become box nodes, spans become text nodes, inline styles resolve to
  terminal colours/attributes. The cell grid flows out as ANSI.

There is only one rendering path.

### EmbeddedTerminal

```svelte
<EmbeddedTerminal {stream} />
```

The composed primitive. Internally:

1. Creates a `Terminal` sized to its allocated cell space
2. Subscribes `stream.onOutput` → `terminal.write`
3. Captures keystrokes from its container → `keyEventToBytes` →
   `stream.write`
4. Observes its own size → `terminal.resize` → `stream.resize`
5. Renders via `<TerminalView>`

This is the component a tmux-style host drops into each pane. All the
caller supplies is a stream.

### PTY adapter

Subpath: `@svelterm/vt100/pty`. Server-side only (Node / Bun).

```ts
import { spawnPty } from '@svelterm/vt100/pty'

const stream = spawnPty('bash', [], { cwd: '/home/alice', env: process.env })
// stream is a TerminalStream
```

Hand-rolled ioctl-based implementation (no `node-pty` dependency, no
native build step). macOS and Linux to begin with. The resulting
`TerminalStream` plugs straight into `EmbeddedTerminal`.

Browser consumers don't import this subpath. They adapt their own source
(v86, WebSocket, etc.) to `TerminalStream`.

## Dual-target rendering

`TerminalView` produces markup meaningful to both a browser DOM engine and
svelterm's renderer:

- Block-level rows, inline cells — both targets understand these
- Inline CSS for per-cell colour/attr — both targets honour the relevant
  properties
- Flow positioning, not absolute — svelterm doesn't handle absolute in
  this mode

In the svelterm target, the output is a grid of ANSI representing a
terminal screen's state — correct, but not *true* passthrough (we parse +
re-emit). If svelterm gains a raw-bytes primitive (a node type that owns a
region and pipes bytes through), `TerminalView` can adopt it in the
svelterm target for true passthrough. That's a framework-side addition,
not a vt100 change.

## Consumer examples

### Low-level: bring your own everything

```ts
const term = new Terminal(80, 24)
term.onChange = () => scheduleRender()
term.write(incomingBytes)

renderCells(term)
container.addEventListener('keydown', e => {
    const bytes = keyEventToBytes(e)
    if (bytes.length) sendToProcess(bytes)
})
```

### Mid-level: view component + own stream wiring

```svelte
<script>
    import { Terminal, TerminalView, keyEventToBytes } from '@svelterm/vt100'

    const terminal = new Terminal(80, 24)
    stream.onOutput(bytes => terminal.write(bytes))

    function onKeydown(e) {
        const bytes = keyEventToBytes(e)
        if (bytes.length) stream.write(bytes)
    }
</script>

<div tabindex="0" onkeydown={onKeydown}>
    <TerminalView {terminal} />
</div>
```

### High-level: drop in a stream

```svelte
<script>
    import { EmbeddedTerminal } from '@svelterm/vt100'
    import { spawnPty } from '@svelterm/vt100/pty'

    const stream = spawnPty('bash')
</script>

<EmbeddedTerminal {stream} />
```

Tmux-style application: one `<EmbeddedTerminal>` per pane, composed with
svelterm's layout primitives.

## What this is not

- **Not a pane manager.** Layout, tabs, status bars live above this
  package.
- **Not a terminal multiplexer.** Session management, detached buffers,
  shared output — those belong to an application built on this primitive.
