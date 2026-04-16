# Block-character rendering in the DOM renderer

## Problem

In the browser DOM renderer (`src/dom.ts`), vertically stacked block-element characters (`▐ ▌ ▀ ▄ ▕ ▏ ▁ ▔ █` etc.) render with visible gaps between rows. Most monospace fonts draw these glyphs with internal padding — the glyph doesn't fill the em box edge-to-edge — so when stacked they leave 1–3 px of transparent space at cell boundaries. Real terminals avoid this by custom-rasterizing block elements to the cell grid; browsers just use the font's glyphs.

## Scope

`svelterm-vt100`'s DOM renderer only. The VT100 state machine, character storage, and the svelterm rendering pipeline are unaffected.

## Design

Ship a tiny custom web font containing only block-element glyphs (U+2580–U+259F), designed with metrics so every glyph fills the em box exactly. Prepend it to the renderer's `font-family` so the browser uses it for block characters and falls back to the author-specified monospace font for everything else.

```css
font-family: "SveltermBlocks", "JetBrains Mono", monospace;
```

No renderer logic changes are required. Browser glyph fallback handles dispatch automatically: the browser picks `SveltermBlocks` for codepoints it defines, and falls back to the next font for all others.

### Font design

- Glyph set: U+2580 through U+259F (32 codepoints)
- Metrics: `ascent` = em, `descent` = 0, so glyphs render from the very top of the line box to the very bottom with no internal padding
- Each glyph is a simple filled rectangle or combination:

| Codepoint | Char | Glyph path |
|-----------|------|------------|
| U+2580 | `▀` | rectangle at top half of em |
| U+2581 | `▁` | rectangle at bottom 1/8 |
| U+2582 | `▂` | rectangle at bottom 1/4 |
| U+2583 | `▃` | rectangle at bottom 3/8 |
| U+2584 | `▄` | rectangle at bottom 1/2 |
| U+2585 | `▅` | rectangle at bottom 5/8 |
| U+2586 | `▆` | rectangle at bottom 3/4 |
| U+2587 | `▇` | rectangle at bottom 7/8 |
| U+2588 | `█` | full em |
| U+2589 | `▉` | rectangle at left 7/8 |
| U+258A | `▊` | rectangle at left 3/4 |
| U+258B | `▋` | rectangle at left 5/8 |
| U+258C | `▌` | rectangle at left 1/2 |
| U+258D | `▍` | rectangle at left 3/8 |
| U+258E | `▎` | rectangle at left 1/4 |
| U+258F | `▏` | rectangle at left 1/8 |
| U+2590 | `▐` | rectangle at right 1/2 |
| U+2591 | `░` | 25%-filled stipple |
| U+2592 | `▒` | 50%-filled stipple |
| U+2593 | `▓` | 75%-filled stipple |
| U+2594 | `▔` | rectangle at top 1/8 |
| U+2595 | `▕` | rectangle at right 1/8 |
| U+2596 | `▖` | quadrant lower-left |
| U+2597 | `▗` | quadrant lower-right |
| U+2598 | `▘` | quadrant upper-left |
| U+2599 | `▙` | three quadrants (upper-left + lower-left + lower-right) |
| U+259A | `▚` | diagonal quadrants (upper-left + lower-right) |
| U+259B | `▛` | three quadrants (upper-left + upper-right + lower-left) |
| U+259C | `▜` | three quadrants (upper-left + upper-right + lower-right) |
| U+259D | `▝` | quadrant upper-right |
| U+259E | `▞` | diagonal quadrants (upper-right + lower-left) |
| U+259F | `▟` | three quadrants (upper-right + lower-left + lower-right) |

### Build process

`scripts/build-blocks-font.mjs` generates the font at build time using `opentype.js`:
- Computes glyph paths programmatically from the table above
- Emits woff2 bytes
- Writes a CSS file containing a `@font-face` declaration with the woff2 embedded as a base64 data URL

The generated CSS is committed to the package so consumers don't need the build tooling. Regenerate by running the script when glyph definitions change.

### Renderer changes

In `src/dom.ts`:
- Prepend `"SveltermBlocks"` to the default font-family.
- Inject the `@font-face` declaration once per renderer instance (via a `<style>` element appended to the document head on first instantiation).

### Stipples (░ ▒ ▓)

Three shades (25%, 50%, 75%). Rendered via the `pattern` / `dither` approach — repeated 1-px dots at appropriate density. These print as vector glyphs, so they scale with the font-size.

## Elephant-carpaccio slices

1. **Font build script.** Write `scripts/build-blocks-font.mjs` generating just the full block (`█`, U+2588) as proof. Output woff2 and CSS file. Commit the generated CSS.

2. **Ship and load in renderer.** Import the CSS in `src/dom.ts`; prepend `"SveltermBlocks"` to default font-family. Verify: a full-block character renders as a solid filled cell in the playground.

3. **Half blocks.** Extend the build script with `▀ ▄ ▌ ▐`. Regenerate font + CSS. Verify `half-cell-*` border styles render continuously vertically and horizontally.

4. **Eighth blocks (outer edges).** Add `▔ ▁ ▏ ▕`. Verify `eighth-cell-*` border styles.

5. **Remaining fractions.** Add `▂▃▅▆▇ ▎▍▋▊▉`.

6. **Quadrants.** Add `▖▗▘▝▙▚▛▜▞▟`.

7. **Shading.** Add `░▒▓` (lower priority — ANSI art territory).

## Testing

- Unit test the build script by asserting the generated CSS contains `@font-face` + expected Unicode range + reasonable byte count.
- Visual verification via the `borders` playground example after each slice (run the site, capture the terminal preview, compare).

## Out of scope

- Sub-pixel anti-aliasing between cell bg colors
- Canvas/WebGL rendering path
- Distributing the font separately (e.g. as a published web-font package)
