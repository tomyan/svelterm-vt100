import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'

describe('resize', () => {
    it('expanding width preserves content', () => {
        const term = new Terminal(5, 3)
        term.write('Hello')
        term.resize(10, 3)
        assert.equal(term.cols, 10)
        assert.equal(term.getRowText(0), 'Hello     ')
    })

    it('shrinking width truncates content', () => {
        const term = new Terminal(10, 3)
        term.write('HelloWorld')
        term.resize(5, 3)
        assert.equal(term.cols, 5)
        assert.equal(term.getRowText(0), 'Hello')
    })

    it('expanding height adds blank rows', () => {
        const term = new Terminal(5, 2)
        term.write('AAAAA\r\nBBBBB')
        term.resize(5, 4)
        assert.equal(term.rows, 4)
        assert.equal(term.getRowText(0), 'AAAAA')
        assert.equal(term.getRowText(1), 'BBBBB')
        assert.equal(term.getRowText(2), '     ')
    })

    it('shrinking height removes bottom rows', () => {
        const term = new Terminal(5, 4)
        term.write('AAAAA\r\nBBBBB\r\nCCCCC\r\nDDDDD')
        term.resize(5, 2)
        assert.equal(term.rows, 2)
        assert.equal(term.getRowText(0), 'AAAAA')
        assert.equal(term.getRowText(1), 'BBBBB')
    })

    it('clamps cursor to new bounds', () => {
        const term = new Terminal(10, 10)
        term.write('\x1b[8;8H') // row 7, col 7
        term.resize(5, 5)
        assert.equal(term.cursor.row, 4)
        assert.equal(term.cursor.col, 4)
    })

    it('resets scroll region on resize', () => {
        const term = new Terminal(10, 10)
        term.write('\x1b[2;8r') // set scroll region
        term.resize(10, 5)
        // Scroll region should be reset to full screen
        // Verify by LF at bottom — should scroll the whole screen
        term.write('\x1b[5;1H')
        term.write('E')
        term.write('\r\n')
        // Should have scrolled
        assert.equal(term.cursor.row, 4)
    })
})

describe('dirty tracking', () => {
    it('initially all rows are dirty', () => {
        const term = new Terminal(10, 3)
        const dirty = term.getDirtyRows()
        assert.deepEqual(dirty, new Set([0, 1, 2]))
    })

    it('clearing dirty resets tracking', () => {
        const term = new Terminal(10, 3)
        term.clearDirty()
        assert.deepEqual(term.getDirtyRows(), new Set())
    })

    it('printing marks row as dirty', () => {
        const term = new Terminal(10, 3)
        term.clearDirty()
        term.write('A')
        assert.ok(term.getDirtyRows().has(0))
        assert.ok(!term.getDirtyRows().has(1))
    })

    it('scrolling marks all affected rows', () => {
        const term = new Terminal(5, 3)
        term.write('AAA\r\nBBB\r\nCCC')
        term.clearDirty()
        term.write('\r\n') // scroll
        const dirty = term.getDirtyRows()
        assert.ok(dirty.has(0))
        assert.ok(dirty.has(1))
        assert.ok(dirty.has(2))
    })

    it('erase marks row as dirty', () => {
        const term = new Terminal(10, 3)
        term.write('ABC')
        term.clearDirty()
        term.write('\x1b[2K')
        assert.ok(term.getDirtyRows().has(0))
    })
})
