import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'

describe('tab stops', () => {
    it('HTS sets a tab stop at cursor column', () => {
        const term = new Terminal(20, 3)
        term.write('\x1b[1;5H') // col 4
        term.write('\x1bH')     // HTS — set tab stop
        term.write('\x1b[1;1H') // back to start
        term.write('\t')
        assert.equal(term.cursor.col, 4)
    })

    it('TBC 0 clears tab stop at cursor', () => {
        const term = new Terminal(20, 3)
        // Clear the default tab stop at col 8
        term.write('\x1b[1;9H') // col 8 (1-based)
        term.write('\x1b[0g')   // TBC — clear at cursor
        term.write('\x1b[1;1H')
        term.write('\t')
        assert.equal(term.cursor.col, 16) // skips 8, goes to 16
    })

    it('TBC 3 clears all tab stops', () => {
        const term = new Terminal(20, 3)
        term.write('\x1b[3g')   // clear all
        term.write('\t')
        assert.equal(term.cursor.col, 19) // goes to last col
    })
})

describe('DEC special graphics character set', () => {
    it('ESC (0 activates line drawing, ESC (B deactivates', () => {
        const term = new Terminal(10, 3)
        term.write('\x1b(0') // activate DEC special graphics
        term.write('lqk')    // should map to ┌─┐
        term.write('\x1b(B') // back to normal
        term.write('X')
        assert.equal(term.getCell(0, 0).char, '┌')
        assert.equal(term.getCell(1, 0).char, '─')
        assert.equal(term.getCell(2, 0).char, '┐')
        assert.equal(term.getCell(3, 0).char, 'X')
    })
})

describe('OSC — window title', () => {
    it('OSC 0 sets title', () => {
        const term = new Terminal(10, 3)
        let title = ''
        term.onTitleChange = (t) => { title = t }
        term.write('\x1b]0;My App\x07')
        assert.equal(title, 'My App')
    })

    it('OSC 2 sets title', () => {
        const term = new Terminal(10, 3)
        let title = ''
        term.onTitleChange = (t) => { title = t }
        term.write('\x1b]2;Window Title\x1b\\')
        assert.equal(title, 'Window Title')
    })
})

describe('OSC 8 — hyperlinks', () => {
    it('sets hyperlink on printed characters', () => {
        const term = new Terminal(20, 3)
        term.write('\x1b]8;;https://example.com\x1b\\')
        term.write('click')
        term.write('\x1b]8;;\x1b\\')
        term.write(' here')

        assert.equal(term.getCell(0, 0).hyperlink, 'https://example.com')
        assert.equal(term.getCell(4, 0).hyperlink, 'https://example.com')
        assert.equal(term.getCell(5, 0).hyperlink, undefined)
    })
})

describe('bell', () => {
    it('fires bell callback', () => {
        const term = new Terminal(10, 3)
        let bellCount = 0
        term.onBell = () => { bellCount++ }
        term.write('\x07')
        assert.equal(bellCount, 1)
    })
})
