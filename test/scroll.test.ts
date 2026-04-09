import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'

describe('insert/delete lines', () => {
    it('IL inserts blank lines at cursor, pushing content down', () => {
        // Given
        const term = new Terminal(5, 5)
        term.write('AAAAA\r\nBBBBB\r\nCCCCC\r\nDDDDD\r\nEEEEE')
        term.write('\x1b[2;1H') // row 1

        // When
        term.write('\x1b[2L') // insert 2 lines

        // Then
        assert.equal(term.getRowText(0), 'AAAAA')
        assert.equal(term.getRowText(1), '     ')
        assert.equal(term.getRowText(2), '     ')
        assert.equal(term.getRowText(3), 'BBBBB')
        assert.equal(term.getRowText(4), 'CCCCC')
        // DDDDD and EEEEE pushed off bottom
    })

    it('DL deletes lines at cursor, pulling content up', () => {
        // Given
        const term = new Terminal(5, 5)
        term.write('AAAAA\r\nBBBBB\r\nCCCCC\r\nDDDDD\r\nEEEEE')
        term.write('\x1b[2;1H') // row 1

        // When
        term.write('\x1b[2M') // delete 2 lines

        // Then
        assert.equal(term.getRowText(0), 'AAAAA')
        assert.equal(term.getRowText(1), 'DDDDD')
        assert.equal(term.getRowText(2), 'EEEEE')
        assert.equal(term.getRowText(3), '     ')
        assert.equal(term.getRowText(4), '     ')
    })
})

describe('insert/delete characters', () => {
    it('ICH inserts blank characters at cursor', () => {
        // Given
        const term = new Terminal(10, 3)
        term.write('ABCDEFGHIJ')
        term.write('\x1b[1;3H') // col 2

        // When
        term.write('\x1b[3@') // insert 3

        // Then
        assert.equal(term.getRowText(0), 'AB   CDEFG')
    })

    it('DCH deletes characters at cursor', () => {
        // Given
        const term = new Terminal(10, 3)
        term.write('ABCDEFGHIJ')
        term.write('\x1b[1;3H') // col 2

        // When
        term.write('\x1b[3P') // delete 3

        // Then
        assert.equal(term.getRowText(0), 'ABFGHIJ   ')
    })
})

describe('scroll regions (DECSTBM)', () => {
    it('sets scroll region and constrains LF scrolling', () => {
        // Given
        const term = new Terminal(5, 5)
        term.write('AAAAA\r\nBBBBB\r\nCCCCC\r\nDDDDD\r\nEEEEE')
        term.write('\x1b[2;4r') // scroll region rows 2-4 (1-based)
        term.write('\x1b[4;1H') // move to bottom of region

        // When
        term.write('\n') // LF at bottom of scroll region

        // Then — only rows 1-3 (0-based) scroll
        assert.equal(term.getRowText(0), 'AAAAA') // above region, untouched
        assert.equal(term.getRowText(1), 'CCCCC') // scrolled up
        assert.equal(term.getRowText(2), 'DDDDD') // scrolled up
        assert.equal(term.getRowText(3), '     ') // new blank line
        assert.equal(term.getRowText(4), 'EEEEE') // below region, untouched
    })

    it('RI at top of scroll region scrolls down within region', () => {
        // Given
        const term = new Terminal(5, 5)
        term.write('AAAAA\r\nBBBBB\r\nCCCCC\r\nDDDDD\r\nEEEEE')
        term.write('\x1b[2;4r')  // scroll region rows 2-4
        term.write('\x1b[2;1H') // move to top of region

        // When
        term.write('\x1bM') // reverse index

        // Then
        assert.equal(term.getRowText(0), 'AAAAA')
        assert.equal(term.getRowText(1), '     ') // new blank
        assert.equal(term.getRowText(2), 'BBBBB')
        assert.equal(term.getRowText(3), 'CCCCC')
        assert.equal(term.getRowText(4), 'EEEEE') // DDDDD pushed off
    })

    it('reset scroll region with no params', () => {
        // Given
        const term = new Terminal(5, 3)
        term.write('\x1b[1;2r') // set region
        term.write('\x1b[r')    // reset

        // Then — scrolling should use full screen
        term.write('AAA\r\nBBB\r\nCCC\r\n')
        assert.equal(term.getRowText(0), 'BBB  ')
    })
})

describe('SU/SD — scroll up/down', () => {
    it('SU scrolls content up', () => {
        // Given
        const term = new Terminal(5, 3)
        term.write('AAAAA\r\nBBBBB\r\nCCCCC')

        // When
        term.write('\x1b[1S')

        // Then
        assert.equal(term.getRowText(0), 'BBBBB')
        assert.equal(term.getRowText(1), 'CCCCC')
        assert.equal(term.getRowText(2), '     ')
    })

    it('SD scrolls content down', () => {
        // Given
        const term = new Terminal(5, 3)
        term.write('AAAAA\r\nBBBBB\r\nCCCCC')

        // When
        term.write('\x1b[1T')

        // Then
        assert.equal(term.getRowText(0), '     ')
        assert.equal(term.getRowText(1), 'AAAAA')
        assert.equal(term.getRowText(2), 'BBBBB')
    })
})
