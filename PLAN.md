# @svelterm/vt100 Plan

## Slice 1: Parser + print + C0 controls

The parser state machine and basic character handling.

- Parser state machine (ground, escape, csi_entry, csi_param, etc.)
- UTF-8 decoding
- Print action (emit printable characters)
- C0 controls: BEL, BS, HT, LF, VT, FF, CR, SO, SI
- CSI sequence collection (params, intermediates, final byte)
- ESC sequence collection
- Tests: parse plain text, parse CSI with params, parse malformed
  sequences, UTF-8 multi-byte

## Slice 2: Cell grid + cursor + basic printing

- Cell grid with configurable dimensions
- Cursor position tracking
- Print characters at cursor position, advance cursor
- Line wrapping (auto-wrap mode)
- Carriage return, line feed (scroll when at bottom)
- Backspace
- Tests: print text wraps at edge, CR+LF moves cursor, grid stores
  characters correctly

## Slice 3: SGR (text attributes)

- Parse SGR parameters (CSI ... m)
- Foreground/background: default, ANSI 8 (30-37, 40-47), ANSI 16
  (90-97, 100-107), 256-color (38;5;n, 48;5;n), truecolor
  (38;2;r;g;b, 48;2;r;g;b)
- Bold, dim, italic, underline, blink, inverse, invisible,
  strikethrough
- Reset (0), individual resets (22, 23, 24, etc.)
- Tests: red text, bold+underline, truecolor, reset clears all

## Slice 4: Cursor movement + erase

- CUP (absolute), CUU/CUD/CUF/CUB (relative)
- CHA (column), VPA (row)
- DECSC/DECRC (save/restore cursor)
- ED (erase display: below, above, all)
- EL (erase line: right, left, all)
- ECH (erase characters)
- Tests: move cursor and print, erase line preserves other lines,
  save/restore cursor position

## Slice 5: Insert/delete + scroll regions

- IL/DL (insert/delete lines)
- ICH/DCH (insert/delete characters)
- DECSTBM (set scroll region)
- SU/SD (scroll up/down)
- Scroll within margins on LF at bottom margin
- Reverse index (RI) at top margin
- Tests: insert line pushes content down, scroll region constrains
  scrolling, delete line within region

## Slice 6: Alternate screen + private modes

- DECSET/DECRST for private modes
- Alternate screen buffer (1049)
- Cursor visibility (25)
- Auto-wrap mode (7)
- Origin mode (6)
- Application cursor keys (1)
- Application keypad (66)
- Mouse modes (9, 1000, 1002, 1003, 1006)
- Bracketed paste mode (2004)
- Synchronized output (2026)
- Tests: switch to alt screen preserves primary, mode queries report
  correctly, cursor hide/show

## Slice 7: Tabs, character sets, misc

- Tab stops: HTS (set), TBC (clear), HT (advance to next)
- Default tab stops every 8 columns
- Character sets: SCS (G0/G1 designation), SO/SI (shift in/out)
- DEC special graphics character set (line drawing)
- Window title (OSC 0, OSC 2)
- Hyperlinks (OSC 8)
- Bell (BEL)
- Tests: tab stops, DEC line drawing characters, title change event

## Slice 8: Resize + scrollback + dirty tracking

- Resize: reflow lines or truncate
- Scrollback buffer (configurable line count, default 1000)
- Scroll through scrollback
- Dirty row tracking (which rows changed since last read)
- Tests: resize smaller truncates, resize larger fills, scrollback
  preserves history, dirty tracking reports changed rows

## Slice 9: Wide characters + edge cases

- Unicode wide characters (CJK): occupy 2 cells
- Overwriting half of a wide character clears the other half
- Zero-width characters (combining marks)
- Long parameter lists in CSI
- Malformed/interrupted sequences
- Tests: wide character handling, combining marks, stress test with
  real terminal output
