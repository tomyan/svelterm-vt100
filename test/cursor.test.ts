import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'

describe('cursor movement', () => {
    describe('CUP — cursor position (absolute)', () => {
        it('moves to specified row and col', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[3;5H')
            assert.equal(term.cursor.row, 2) // 1-based → 0-based
            assert.equal(term.cursor.col, 4)
        })

        it('defaults to 1;1 with no params', () => {
            const term = new Terminal(10, 5)
            term.write('XXXXX')
            term.write('\x1b[H')
            assert.equal(term.cursor.row, 0)
            assert.equal(term.cursor.col, 0)
        })

        it('clamps to screen bounds', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[99;99H')
            assert.equal(term.cursor.row, 4)
            assert.equal(term.cursor.col, 9)
        })
    })

    describe('CUU/CUD/CUF/CUB — relative movement', () => {
        it('CUU moves cursor up', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[3;5H') // row 2, col 4
            term.write('\x1b[2A')   // up 2
            assert.equal(term.cursor.row, 0)
            assert.equal(term.cursor.col, 4)
        })

        it('CUD moves cursor down', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[1;1H')
            term.write('\x1b[3B')   // down 3
            assert.equal(term.cursor.row, 3)
        })

        it('CUF moves cursor right', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[1;1H')
            term.write('\x1b[5C')   // right 5
            assert.equal(term.cursor.col, 5)
        })

        it('CUB moves cursor left', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[1;6H') // col 5
            term.write('\x1b[3D')   // left 3
            assert.equal(term.cursor.col, 2)
        })

        it('default count is 1', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[3;5H')
            term.write('\x1b[A')
            assert.equal(term.cursor.row, 1)
        })

        it('clamps at edges', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[1;1H')
            term.write('\x1b[99A')
            assert.equal(term.cursor.row, 0)
        })
    })

    describe('CHA — cursor horizontal absolute', () => {
        it('moves to specified column', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[7G')
            assert.equal(term.cursor.col, 6) // 1-based
        })

        it('defaults to column 1', () => {
            const term = new Terminal(10, 5)
            term.write('XXXXX')
            term.write('\x1b[G')
            assert.equal(term.cursor.col, 0)
        })
    })

    describe('VPA — vertical position absolute', () => {
        it('moves to specified row', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[3d')
            assert.equal(term.cursor.row, 2) // 1-based
        })
    })

    describe('DECSC/DECRC — save/restore cursor', () => {
        it('saves and restores cursor position', () => {
            const term = new Terminal(10, 5)
            term.write('\x1b[3;5H')
            term.write('\x1b7')      // save
            term.write('\x1b[1;1H')  // move
            term.write('\x1b8')      // restore
            assert.equal(term.cursor.row, 2)
            assert.equal(term.cursor.col, 4)
        })
    })
})

describe('erase operations', () => {
    describe('ED — erase display', () => {
        it('ED 0 erases from cursor to end of screen', () => {
            const term = new Terminal(5, 3)
            term.write('AAAAABBBBBCCCCC')
            term.write('\x1b[2;3H') // row 1, col 2
            term.write('\x1b[0J')
            // Row 0 untouched
            assert.equal(term.getRowText(0), 'AAAAA')
            // Row 1: first 2 chars preserved
            assert.equal(term.getRowText(1), 'BB   ')
            // Row 2: cleared
            assert.equal(term.getRowText(2), '     ')
        })

        it('ED 1 erases from start of screen to cursor', () => {
            const term = new Terminal(5, 3)
            term.write('AAAAABBBBBCCCCC')
            term.write('\x1b[2;3H')
            term.write('\x1b[1J')
            // Row 0: cleared
            assert.equal(term.getRowText(0), '     ')
            // Row 1: up to and including cursor cleared
            assert.equal(term.getRowText(1), '   BB')
            // Row 2: untouched
            assert.equal(term.getRowText(2), 'CCCCC')
        })

        it('ED 2 erases entire display', () => {
            const term = new Terminal(5, 3)
            term.write('AAAAABBBBBCCCCC')
            term.write('\x1b[2J')
            assert.equal(term.getRowText(0), '     ')
            assert.equal(term.getRowText(1), '     ')
            assert.equal(term.getRowText(2), '     ')
        })
    })

    describe('EL — erase line', () => {
        it('EL 0 erases from cursor to end of line', () => {
            const term = new Terminal(10, 3)
            term.write('ABCDEFGHIJ')
            term.write('\x1b[1;4H') // col 3
            term.write('\x1b[0K')
            assert.equal(term.getRowText(0), 'ABC       ')
        })

        it('EL 1 erases from start of line to cursor', () => {
            const term = new Terminal(10, 3)
            term.write('ABCDEFGHIJ')
            term.write('\x1b[1;4H')
            term.write('\x1b[1K')
            assert.equal(term.getRowText(0), '    EFGHIJ')
        })

        it('EL 2 erases entire line', () => {
            const term = new Terminal(10, 3)
            term.write('ABCDEFGHIJ')
            term.write('\x1b[1;4H')
            term.write('\x1b[2K')
            assert.equal(term.getRowText(0), '          ')
        })
    })

    describe('ECH — erase characters', () => {
        it('erases N characters from cursor', () => {
            const term = new Terminal(10, 3)
            term.write('ABCDEFGHIJ')
            term.write('\x1b[1;3H') // col 2
            term.write('\x1b[4X')   // erase 4
            assert.equal(term.getRowText(0), 'AB    GHIJ')
        })
    })
})
