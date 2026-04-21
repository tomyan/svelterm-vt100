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

for (const cp of [0x2594, 0x2581, 0x258F]) {
    const idx = Object.values(font.glyphs.glyphs).findIndex(g => g.unicode === cp)
    const g = font.glyphs.glyphs[idx]
    console.log(`\nglyph U+${cp.toString(16).toUpperCase()} (${String.fromCodePoint(cp)}):`)
    console.log('  unicode:', g.unicode)
    console.log('  advanceWidth:', g.advanceWidth)
    const path = g.path
    if (path && path.commands) {
        console.log('  path commands:', JSON.stringify(path.commands.slice(0, 10)))
    }
}
