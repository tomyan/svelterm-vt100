import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'

describe('alternate screen buffer', () => {
    it('switches to alt screen and back preserving primary content', () => {
        // Given
        const term = new Terminal(5, 3)
        term.write('Hello')

        // When — switch to alt screen
        term.write('\x1b[?1049h')
        assert.equal(term.getRowText(0), '     ') // alt screen is blank

        term.write('World')

        // When — switch back
        term.write('\x1b[?1049l')

        // Then — primary content restored
        assert.equal(term.getRowText(0), 'Hello')
    })

    it('alt screen content is discarded on switch back', () => {
        const term = new Terminal(5, 3)
        term.write('\x1b[?1049h')
        term.write('XXXXX')
        term.write('\x1b[?1049l')
        term.write('\x1b[?1049h')
        // Fresh alt screen
        assert.equal(term.getRowText(0), '     ')
    })
})

describe('cursor visibility', () => {
    it('DECTCEM hides cursor', () => {
        const term = new Terminal(10, 3)
        assert.equal(term.cursor.visible, true)
        term.write('\x1b[?25l')
        assert.equal(term.cursor.visible, false)
    })

    it('DECTCEM shows cursor', () => {
        const term = new Terminal(10, 3)
        term.write('\x1b[?25l')
        term.write('\x1b[?25h')
        assert.equal(term.cursor.visible, true)
    })
})

describe('mode queries', () => {
    it('tracks mouse mode', () => {
        const term = new Terminal(10, 3)
        assert.equal(term.mouseMode, 'none')

        term.write('\x1b[?1000h') // normal tracking
        assert.equal(term.mouseMode, 'normal')

        term.write('\x1b[?1003h') // any-event tracking
        assert.equal(term.mouseMode, 'any')

        term.write('\x1b[?1003l')
        assert.equal(term.mouseMode, 'normal')

        term.write('\x1b[?1000l')
        assert.equal(term.mouseMode, 'none')
    })

    it('tracks SGR mouse mode', () => {
        const term = new Terminal(10, 3)
        term.write('\x1b[?1006h')
        assert.equal(term.sgrMouse, true)
        term.write('\x1b[?1006l')
        assert.equal(term.sgrMouse, false)
    })

    it('tracks bracketed paste mode', () => {
        const term = new Terminal(10, 3)
        assert.equal(term.bracketedPaste, false)
        term.write('\x1b[?2004h')
        assert.equal(term.bracketedPaste, true)
        term.write('\x1b[?2004l')
        assert.equal(term.bracketedPaste, false)
    })

    it('tracks application cursor mode', () => {
        const term = new Terminal(10, 3)
        assert.equal(term.applicationCursor, false)
        term.write('\x1b[?1h')
        assert.equal(term.applicationCursor, true)
        term.write('\x1b[?1l')
        assert.equal(term.applicationCursor, false)
    })

    it('tracks auto-wrap mode', () => {
        const term = new Terminal(10, 3)
        assert.equal(term.autoWrap, true) // default on
        term.write('\x1b[?7l')
        assert.equal(term.autoWrap, false)
        term.write('\x1b[?7h')
        assert.equal(term.autoWrap, true)
    })
})
