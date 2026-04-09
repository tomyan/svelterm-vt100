import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'

describe('Terminal', () => {
    describe('basic printing', () => {
        it('prints characters at cursor position', () => {
            // Given
            const term = new Terminal(10, 5)

            // When
            term.write('Hello')

            // Then
            assert.equal(term.getCell(0, 0).char, 'H')
            assert.equal(term.getCell(1, 0).char, 'e')
            assert.equal(term.getCell(2, 0).char, 'l')
            assert.equal(term.getCell(3, 0).char, 'l')
            assert.equal(term.getCell(4, 0).char, 'o')
            assert.equal(term.cursor.col, 5)
            assert.equal(term.cursor.row, 0)
        })

        it('initialises cells to spaces', () => {
            // Given
            const term = new Terminal(5, 3)

            // Then
            assert.equal(term.getCell(0, 0).char, ' ')
            assert.equal(term.getCell(4, 2).char, ' ')
        })

        it('advances cursor after each character', () => {
            // Given
            const term = new Terminal(10, 5)

            // When
            term.write('AB')

            // Then
            assert.equal(term.cursor.col, 2)
            assert.equal(term.cursor.row, 0)
        })
    })

    describe('line wrapping', () => {
        it('wraps to next line when reaching right edge', () => {
            // Given
            const term = new Terminal(5, 3)

            // When
            term.write('ABCDEF')

            // Then
            assert.equal(term.getCell(0, 0).char, 'A')
            assert.equal(term.getCell(4, 0).char, 'E')
            assert.equal(term.getCell(0, 1).char, 'F')
            assert.equal(term.cursor.col, 1)
            assert.equal(term.cursor.row, 1)
        })

        it('wraps multiple times', () => {
            // Given
            const term = new Terminal(3, 5)

            // When
            term.write('ABCDEFG')

            // Then
            assert.equal(term.getCell(0, 0).char, 'A')
            assert.equal(term.getCell(0, 1).char, 'D')
            assert.equal(term.getCell(0, 2).char, 'G')
            assert.equal(term.cursor.col, 1)
            assert.equal(term.cursor.row, 2)
        })
    })

    describe('CR and LF', () => {
        it('CR moves cursor to column 0', () => {
            // Given
            const term = new Terminal(10, 5)
            term.write('Hello')

            // When
            term.write('\r')

            // Then
            assert.equal(term.cursor.col, 0)
            assert.equal(term.cursor.row, 0)
        })

        it('LF moves cursor down one row', () => {
            // Given
            const term = new Terminal(10, 5)

            // When
            term.write('A\n')

            // Then
            assert.equal(term.cursor.col, 1)
            assert.equal(term.cursor.row, 1)
        })

        it('CR+LF moves to start of next line', () => {
            // Given
            const term = new Terminal(10, 5)

            // When
            term.write('Hello\r\nWorld')

            // Then
            assert.equal(term.getCell(0, 0).char, 'H')
            assert.equal(term.getCell(0, 1).char, 'W')
        })
    })

    describe('scrolling', () => {
        it('scrolls when LF at bottom of screen', () => {
            // Given
            const term = new Terminal(5, 3)
            term.write('AAA\r\nBBB\r\nCCC')

            // When
            term.write('\r\n')

            // Then — row 0 should now contain BBB (AAA scrolled off)
            assert.equal(term.getCell(0, 0).char, 'B')
            assert.equal(term.getCell(0, 1).char, 'C')
            assert.equal(term.getCell(0, 2).char, ' ')
            assert.equal(term.cursor.col, 0)
            assert.equal(term.cursor.row, 2)
        })

        it('scrolls when wrapping past bottom', () => {
            // Given
            const term = new Terminal(3, 2)
            term.write('AABBBC')

            // When — next char wraps and scrolls
            term.write('D')

            // Then
            assert.equal(term.getCell(0, 0).char, 'B')
            assert.equal(term.getCell(1, 0).char, 'B')
            assert.equal(term.getCell(2, 0).char, 'C')
            assert.equal(term.getCell(0, 1).char, 'D')
        })
    })

    describe('backspace', () => {
        it('moves cursor left by one', () => {
            // Given
            const term = new Terminal(10, 5)
            term.write('ABC')

            // When
            term.write('\x08')

            // Then
            assert.equal(term.cursor.col, 2)
        })

        it('does not move past column 0', () => {
            // Given
            const term = new Terminal(10, 5)

            // When
            term.write('\x08')

            // Then
            assert.equal(term.cursor.col, 0)
        })
    })

    describe('horizontal tab', () => {
        it('advances to next tab stop', () => {
            // Given
            const term = new Terminal(20, 5)

            // When
            term.write('\t')

            // Then — default tab stops at every 8 columns
            assert.equal(term.cursor.col, 8)
        })

        it('advances from mid-tab to next stop', () => {
            // Given
            const term = new Terminal(20, 5)
            term.write('ABC')

            // When
            term.write('\t')

            // Then
            assert.equal(term.cursor.col, 8)
        })

        it('does not advance past last column', () => {
            // Given
            const term = new Terminal(10, 5)
            term.write('ABCDEFGH')

            // When
            term.write('\t')

            // Then
            assert.equal(term.cursor.col, 9)
        })
    })

    describe('size', () => {
        it('reports correct dimensions', () => {
            // Given
            const term = new Terminal(80, 24)

            // Then
            assert.equal(term.cols, 80)
            assert.equal(term.rows, 24)
        })
    })

    describe('getText helper', () => {
        it('returns row content as string', () => {
            // Given
            const term = new Terminal(10, 3)
            term.write('Hello')

            // Then
            assert.equal(term.getRowText(0), 'Hello     ')
        })
    })
})
