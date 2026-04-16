/**
 * Generate the SveltermBlocks web font — a minimal font containing
 * Unicode block element glyphs (U+2580–U+259F) with metrics chosen
 * so each glyph fills the em box edge-to-edge.
 *
 * Outputs src/blocks-font.css with a @font-face declaration embedding
 * the TTF as a base64 data URL. Run `node scripts/build-blocks-font.mjs`
 * after changing glyph definitions.
 */

import opentype from 'opentype.js'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_CSS = join(__dirname, '..', 'src', 'blocks-font.css')
const OUT_TS = join(__dirname, '..', 'src', 'blocks-font.ts')

const UNITS_PER_EM = 1000
const ASCENDER = UNITS_PER_EM
const DESCENDER = 0
const ADVANCE = 600  // monospace-ish, but irrelevant for layout (renderer uses measured width)

/**
 * A glyph is defined as a list of rectangles, each in units where
 * 0,0 is bottom-left of the em box and UNITS_PER_EM,UNITS_PER_EM is top-right.
 * Each rectangle is [x, y, width, height].
 */
function rect(x, y, w, h) {
    const path = new opentype.Path()
    path.moveTo(x, y)
    path.lineTo(x + w, y)
    path.lineTo(x + w, y + h)
    path.lineTo(x, y + h)
    path.close()
    return path
}

/** Combine multiple rectangles into one path */
function rectsPath(rects) {
    const path = new opentype.Path()
    for (const [x, y, w, h] of rects) {
        path.moveTo(x, y)
        path.lineTo(x + w, y)
        path.lineTo(x + w, y + h)
        path.lineTo(x, y + h)
        path.close()
    }
    return path
}

// Cell width for glyphs that care about horizontal extent.
// We use ADVANCE here so the glyph visually fills the author's monospace cell
// when the browser scales it. This isn't perfect for all fonts but aligns
// for most monospace fonts where ~ 0.6em is the character advance.
const CELL_W = ADVANCE
const CELL_H = UNITS_PER_EM

/**
 * Glyph definitions. Each entry maps a codepoint to a list of rectangles
 * in OpenType em units. Coordinates: (0,0) = bottom-left of em.
 */
// Helpers for common shapes
const lowerN8 = (n) => [[0, 0, CELL_W, (CELL_H * n) / 8]]
const leftN8  = (n) => [[0, 0, (CELL_W * n) / 8, CELL_H]]
const upperN8 = (n) => [[0, CELL_H - (CELL_H * n) / 8, CELL_W, (CELL_H * n) / 8]]
const rightN8 = (n) => [[CELL_W - (CELL_W * n) / 8, 0, (CELL_W * n) / 8, CELL_H]]

// Quadrants — each rectangle is half the em in each axis
const QUAD_TL = [0, CELL_H / 2, CELL_W / 2, CELL_H / 2]
const QUAD_TR = [CELL_W / 2, CELL_H / 2, CELL_W / 2, CELL_H / 2]
const QUAD_BL = [0, 0, CELL_W / 2, CELL_H / 2]
const QUAD_BR = [CELL_W / 2, 0, CELL_W / 2, CELL_H / 2]

const GLYPHS = {
    // Horizontal lower fractions (stroke at bottom of cell)
    0x2581: lowerN8(1),  // ▁
    0x2582: lowerN8(2),  // ▂
    0x2583: lowerN8(3),  // ▃
    0x2584: lowerN8(4),  // ▄ lower half
    0x2585: lowerN8(5),  // ▅
    0x2586: lowerN8(6),  // ▆
    0x2587: lowerN8(7),  // ▇
    0x2588: lowerN8(8),  // █ full block

    // Vertical left fractions (stroke at left of cell)
    0x2589: leftN8(7),   // ▉
    0x258A: leftN8(6),   // ▊
    0x258B: leftN8(5),   // ▋
    0x258C: leftN8(4),   // ▌ left half
    0x258D: leftN8(3),   // ▍
    0x258E: leftN8(2),   // ▎
    0x258F: leftN8(1),   // ▏

    // Right / upper half and eighths
    0x2590: rightN8(4),  // ▐ right half
    0x2594: upperN8(1),  // ▔ upper 1/8
    0x2595: rightN8(1),  // ▕ right 1/8
    0x2580: upperN8(4),  // ▀ upper half

    // Quadrants
    0x2596: [QUAD_BL],                           // ▖
    0x2597: [QUAD_BR],                           // ▗
    0x2598: [QUAD_TL],                           // ▘
    0x2599: [QUAD_TL, QUAD_BL, QUAD_BR],         // ▙
    0x259A: [QUAD_TL, QUAD_BR],                  // ▚
    0x259B: [QUAD_TL, QUAD_TR, QUAD_BL],         // ▛
    0x259C: [QUAD_TL, QUAD_TR, QUAD_BR],         // ▜
    0x259D: [QUAD_TR],                           // ▝
    0x259E: [QUAD_TR, QUAD_BL],                  // ▞
    0x259F: [QUAD_TR, QUAD_BL, QUAD_BR],         // ▟
}

function buildFont() {
    // Required .notdef glyph
    const notdef = new opentype.Glyph({
        name: '.notdef',
        unicode: 0,
        advanceWidth: ADVANCE,
        path: new opentype.Path(),
    })

    const glyphs = [notdef]

    for (const [codepoint, rects] of Object.entries(GLYPHS)) {
        const cp = Number(codepoint)
        glyphs.push(new opentype.Glyph({
            name: `u${cp.toString(16).toUpperCase()}`,
            unicode: cp,
            advanceWidth: ADVANCE,
            path: rectsPath(rects),
        }))
    }

    const font = new opentype.Font({
        familyName: 'SveltermBlocks',
        styleName: 'Regular',
        unitsPerEm: UNITS_PER_EM,
        ascender: ASCENDER,
        descender: -DESCENDER,  // opentype.js wants negative descender
        glyphs,
    })

    return font
}

function writeCss(font) {
    const buf = Buffer.from(font.toArrayBuffer())
    const b64 = buf.toString('base64')
    const css = `/* Auto-generated by scripts/build-blocks-font.mjs. Do not edit by hand. */
@font-face {
    font-family: 'SveltermBlocks';
    src: url(data:font/ttf;base64,${b64}) format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: block;
    unicode-range: U+2580-259F;
}
`
    writeFileSync(OUT_CSS, css, 'utf8')

    const ts = `// Auto-generated by scripts/build-blocks-font.mjs. Do not edit by hand.
export const BLOCKS_FONT_CSS = ${JSON.stringify(css)}
`
    writeFileSync(OUT_TS, ts, 'utf8')
    console.log(`Wrote ${OUT_CSS} and ${OUT_TS} (${css.length} bytes CSS, ${buf.length} bytes font)`)
}

const font = buildFont()
writeCss(font)
