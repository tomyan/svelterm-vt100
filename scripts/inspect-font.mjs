import opentype from 'opentype.js'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/blocks-font.css', import.meta.url), 'utf8')
const b64 = css.match(/base64,([^)]+)\)/)[1]
const buf = Buffer.from(b64, 'base64')
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

console.log('unitsPerEm:', font.unitsPerEm)
console.log('ascender:', font.ascender)
console.log('descender:', font.descender)
console.log('tables:')
console.log('  hhea.ascender:', font.tables.hhea?.ascender)
console.log('  hhea.descender:', font.tables.hhea?.descender)
console.log('  hhea.lineGap:', font.tables.hhea?.lineGap)
console.log('  os2.usWinAscent:', font.tables.os2?.usWinAscent)
console.log('  os2.usWinDescent:', font.tables.os2?.usWinDescent)
console.log('  os2.sTypoAscender:', font.tables.os2?.sTypoAscender)
console.log('  os2.sTypoDescender:', font.tables.os2?.sTypoDescender)
console.log('  os2.sTypoLineGap:', font.tables.os2?.sTypoLineGap)

const u2502 = font.glyphs.glyphs[Object.values(font.glyphs.glyphs).findIndex(g => g.unicode === 0x2502)]
if (u2502) {
    console.log('\n│ glyph (U+2502):')
    console.log('  xMin:', u2502.xMin, 'xMax:', u2502.xMax)
    console.log('  yMin:', u2502.yMin, 'yMax:', u2502.yMax)
    console.log('  advanceWidth:', u2502.advanceWidth)
}
