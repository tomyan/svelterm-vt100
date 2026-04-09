# @svelterm/vt100 Design

A complete VT100/VT220/xterm terminal emulator in TypeScript. Interprets
ANSI escape sequences and maintains a cell grid. No rendering opinion —
consumers render the grid however they want (DOM, canvas, svelterm cells).

## Architecture

```
input bytes → Parser → Terminal state machine → Cell grid
                                                    ↑
                                              consumer reads
```

Three layers:

### 1. Parser

Byte-level ANSI escape sequence parser. Classifies input into:

- **Print** — regular characters to display
- **Execute** — C0/C1 control codes (BEL, BS, HT, LF, CR, etc.)
- **CSI** — Control Sequence Introducer (`ESC [` params final)
- **OSC** — Operating System Command (`ESC ]` ... ST)
- **DCS** — Device Control String (`ESC P` ... ST)
- **ESC** — Simple escape sequences (`ESC` + intermediate + final)

The parser is a state machine following the VT500-series model
(Paul Flo Williams' parser). It handles:
- UTF-8 decoding
- Malformed sequences (recover gracefully)
- Intermediate bytes in CSI/ESC sequences
- Parameters with defaults and sub-parameters (`;` and `:`)

The parser emits events — it does not interpret them. That's the
terminal's job.

### 2. Terminal

Interprets parsed sequences and updates state:

**Screen state:**
- Primary and alternate screen buffers
- Cursor position, style (block/underline/bar), visibility
- Scroll region (DECSTBM top/bottom margins)
- Tab stops
- Origin mode (DECOM)
- Auto-wrap mode (DECAWM)
- Insert/replace mode (IRM)
- Character sets (G0/G1, SCS)

**Cell attributes (SGR):**
- Foreground color: default, ANSI 8, ANSI 16, 256-color, truecolor
- Background color: same
- Bold, dim, italic, underline, blink, inverse, invisible, strikethrough
- Underline styles (single, double, curly, dotted, dashed)
- Hyperlinks (OSC 8)

**Operations:**
- Print character at cursor, advance cursor
- Cursor movement: absolute (CUP), relative (CUU/CUD/CUF/CUB),
  save/restore (DECSC/DECRC), column (CHA), line (VPA)
- Erase: line (EL), display (ED), characters (ECH)
- Insert/delete: lines (IL/DL), characters (ICH/DCH)
- Scroll: up (SU), down (SD), within margins
- Tabs: set (HTS), clear (TBC), horizontal tab (HT)
- Line feed, carriage return, backspace
- Alternate screen: switch (DECSET 1049), clear on switch
- Private modes: DECSET/DECRST for all common modes
- Window title (OSC 0/2)
- Mouse mode tracking state (for reporting back to consumer)
- Bracketed paste mode tracking
- Synchronized output mode (DEC 2026)

### 3. Cell Grid

The grid is the output — a 2D array of cells that consumers read.

```typescript
interface Cell {
    char: string          // single character (or empty)
    width: number         // 1 for normal, 2 for wide (CJK)
    fg: Color
    bg: Color
    attrs: number         // bit flags for bold, dim, italic, etc.
    hyperlink?: string    // OSC 8 URI
}

type Color =
    | { type: 'default' }
    | { type: 'indexed'; index: number }    // 0-255
    | { type: 'rgb'; r: number; g: number; b: number }
```

The grid supports:
- Resize (reflow or truncate)
- Scrollback buffer (configurable line count)
- Dirty tracking (which rows changed since last read)

## Consumer Interface

```typescript
const term = new Terminal({ cols: 80, rows: 24 })

// Feed input
term.write('Hello \x1b[31mworld\x1b[0m\r\n')
term.write(buffer)  // Uint8Array also accepted

// Read state
const cell = term.getCell(col, row)
const cursor = term.cursor        // { col, row, visible, style }
const title = term.title
const size = term.size             // { cols, rows }
const dirtyRows = term.getDirtyRows()
term.clearDirty()

// Resize
term.resize(120, 40)

// Mode queries (for input routing)
term.mouseMode                     // 'none' | 'x10' | 'normal' | 'sgr'
term.bracketedPaste                // boolean
term.applicationCursor             // boolean (for arrow key encoding)
term.applicationKeypad             // boolean

// Events
term.onTitleChange(title => ...)
term.onBell(() => ...)
term.onResize(({ cols, rows }) => ...)
```

## What This Is Not

- **Not a renderer.** No DOM, no canvas, no terminal output. Just state.
- **Not an input encoder.** Consumers encode keyboard/mouse events into
  ANSI and feed them via `write()`. A separate utility can help with
  this.
- **Not a PTY.** No process spawning. Consumers connect their own IO.
