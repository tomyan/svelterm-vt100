import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'
import { Attr } from '../src/cell.js'

describe('SGR (text attributes)', () => {
    describe('reset', () => {
        it('SGR 0 resets all attributes', () => {
            // Given
            const term = new Terminal(10, 3)
            term.write('\x1b[1;31m')  // bold + red

            // When
            term.write('\x1b[0m')
            term.write('A')

            // Then
            const cell = term.getCell(0, 0)
            assert.equal(cell.attrs, Attr.None)
            assert.deepEqual(cell.fg, { type: 'default' })
        })

        it('SGR with no params resets (same as 0)', () => {
            // Given
            const term = new Terminal(10, 3)
            term.write('\x1b[1m')

            // When
            term.write('\x1b[m')
            term.write('A')

            // Then
            assert.equal(term.getCell(0, 0).attrs, Attr.None)
        })
    })

    describe('text style attributes', () => {
        it('SGR 1 sets bold', () => {
            // Given
            const term = new Terminal(10, 3)

            // When
            term.write('\x1b[1mA')

            // Then
            assert.equal(term.getCell(0, 0).attrs & Attr.Bold, Attr.Bold)
        })

        it('SGR 2 sets dim', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[2mA')
            assert.equal(term.getCell(0, 0).attrs & Attr.Dim, Attr.Dim)
        })

        it('SGR 3 sets italic', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[3mA')
            assert.equal(term.getCell(0, 0).attrs & Attr.Italic, Attr.Italic)
        })

        it('SGR 4 sets underline', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[4mA')
            assert.equal(term.getCell(0, 0).attrs & Attr.Underline, Attr.Underline)
        })

        it('SGR 5 sets blink', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[5mA')
            assert.equal(term.getCell(0, 0).attrs & Attr.Blink, Attr.Blink)
        })

        it('SGR 7 sets inverse', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[7mA')
            assert.equal(term.getCell(0, 0).attrs & Attr.Inverse, Attr.Inverse)
        })

        it('SGR 8 sets invisible', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[8mA')
            assert.equal(term.getCell(0, 0).attrs & Attr.Invisible, Attr.Invisible)
        })

        it('SGR 9 sets strikethrough', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[9mA')
            assert.equal(term.getCell(0, 0).attrs & Attr.Strikethrough, Attr.Strikethrough)
        })

        it('multiple attributes combine', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[1;3;4mA')
            const attrs = term.getCell(0, 0).attrs
            assert.equal(attrs & Attr.Bold, Attr.Bold)
            assert.equal(attrs & Attr.Italic, Attr.Italic)
            assert.equal(attrs & Attr.Underline, Attr.Underline)
        })
    })

    describe('attribute resets', () => {
        it('SGR 22 resets bold and dim', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[1;2mX\x1b[22mA')
            const cell = term.getCell(1, 0)
            assert.equal(cell.attrs & Attr.Bold, 0)
            assert.equal(cell.attrs & Attr.Dim, 0)
        })

        it('SGR 23 resets italic', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[3mX\x1b[23mA')
            assert.equal(term.getCell(1, 0).attrs & Attr.Italic, 0)
        })

        it('SGR 24 resets underline', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[4mX\x1b[24mA')
            assert.equal(term.getCell(1, 0).attrs & Attr.Underline, 0)
        })

        it('SGR 25 resets blink', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[5mX\x1b[25mA')
            assert.equal(term.getCell(1, 0).attrs & Attr.Blink, 0)
        })

        it('SGR 27 resets inverse', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[7mX\x1b[27mA')
            assert.equal(term.getCell(1, 0).attrs & Attr.Inverse, 0)
        })

        it('SGR 28 resets invisible', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[8mX\x1b[28mA')
            assert.equal(term.getCell(1, 0).attrs & Attr.Invisible, 0)
        })

        it('SGR 29 resets strikethrough', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[9mX\x1b[29mA')
            assert.equal(term.getCell(1, 0).attrs & Attr.Strikethrough, 0)
        })
    })

    describe('ANSI 8 foreground colors', () => {
        it('SGR 30 sets black fg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[30mA')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'indexed', index: 0 })
        })

        it('SGR 31 sets red fg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[31mA')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'indexed', index: 1 })
        })

        it('SGR 37 sets white fg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[37mA')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'indexed', index: 7 })
        })

        it('SGR 39 resets fg to default', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[31mX\x1b[39mA')
            assert.deepEqual(term.getCell(1, 0).fg, { type: 'default' })
        })
    })

    describe('ANSI 8 background colors', () => {
        it('SGR 40 sets black bg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[40mA')
            assert.deepEqual(term.getCell(0, 0).bg, { type: 'indexed', index: 0 })
        })

        it('SGR 47 sets white bg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[47mA')
            assert.deepEqual(term.getCell(0, 0).bg, { type: 'indexed', index: 7 })
        })

        it('SGR 49 resets bg to default', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[41mX\x1b[49mA')
            assert.deepEqual(term.getCell(1, 0).bg, { type: 'default' })
        })
    })

    describe('bright/ANSI 16 colors', () => {
        it('SGR 90 sets bright black fg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[90mA')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'indexed', index: 8 })
        })

        it('SGR 97 sets bright white fg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[97mA')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'indexed', index: 15 })
        })

        it('SGR 100 sets bright black bg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[100mA')
            assert.deepEqual(term.getCell(0, 0).bg, { type: 'indexed', index: 8 })
        })

        it('SGR 107 sets bright white bg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[107mA')
            assert.deepEqual(term.getCell(0, 0).bg, { type: 'indexed', index: 15 })
        })
    })

    describe('256-color', () => {
        it('SGR 38;5;n sets 256-color fg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[38;5;196mA')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'indexed', index: 196 })
        })

        it('SGR 48;5;n sets 256-color bg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[48;5;22mA')
            assert.deepEqual(term.getCell(0, 0).bg, { type: 'indexed', index: 22 })
        })
    })

    describe('truecolor', () => {
        it('SGR 38;2;r;g;b sets truecolor fg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[38;2;255;128;0mA')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'rgb', r: 255, g: 128, b: 0 })
        })

        it('SGR 48;2;r;g;b sets truecolor bg', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[48;2;0;100;200mA')
            assert.deepEqual(term.getCell(0, 0).bg, { type: 'rgb', r: 0, g: 100, b: 200 })
        })
    })

    describe('attributes persist across characters', () => {
        it('color applies to subsequent characters', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[31mABC')
            assert.deepEqual(term.getCell(0, 0).fg, { type: 'indexed', index: 1 })
            assert.deepEqual(term.getCell(1, 0).fg, { type: 'indexed', index: 1 })
            assert.deepEqual(term.getCell(2, 0).fg, { type: 'indexed', index: 1 })
        })

        it('reset only affects subsequent characters', () => {
            const term = new Terminal(10, 3)
            term.write('\x1b[1mA\x1b[0mB')
            assert.equal(term.getCell(0, 0).attrs & Attr.Bold, Attr.Bold)
            assert.equal(term.getCell(1, 0).attrs & Attr.Bold, 0)
        })
    })
})
