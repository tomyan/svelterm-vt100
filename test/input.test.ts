import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { keyEventToBytes, type KeyInput } from '../src/input.js'

const decoder = new TextDecoder('utf-8')

function ev(key: string, mods: Partial<Omit<KeyInput, 'key'>> = {}): KeyInput {
    return { key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods }
}

function emit(event: KeyInput): string {
    return decoder.decode(keyEventToBytes(event))
}

describe('keyEventToBytes', () => {
    describe('printable characters', () => {
        const cases: [string, string][] = [
            ['a', 'a'],
            ['z', 'z'],
            ['A', 'A'],
            ['0', '0'],
            ['9', '9'],
            [' ', ' '],
            ['!', '!'],
            ['~', '~'],
        ]
        for (const [key, expected] of cases) {
            it(`maps "${key}" → ${JSON.stringify(expected)}`, () => {
                assert.equal(emit(ev(key)), expected)
            })
        }
    })

    describe('modifier-only events', () => {
        for (const key of ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead']) {
            it(`returns empty for "${key}"`, () => {
                assert.equal(emit(ev(key)), '')
            })
        }
    })

    describe('special keys', () => {
        const cases: [string, string][] = [
            ['Enter', '\r'],
            ['Tab', '\t'],
            ['Backspace', '\x7f'],
            ['Escape', '\x1b'],
        ]
        for (const [key, expected] of cases) {
            it(`maps "${key}" → ${JSON.stringify(expected)}`, () => {
                assert.equal(emit(ev(key)), expected)
            })
        }
    })

    describe('arrow keys (normal mode)', () => {
        const cases: [string, string][] = [
            ['ArrowUp', '\x1b[A'],
            ['ArrowDown', '\x1b[B'],
            ['ArrowRight', '\x1b[C'],
            ['ArrowLeft', '\x1b[D'],
        ]
        for (const [key, expected] of cases) {
            it(`maps "${key}" → ${JSON.stringify(expected)}`, () => {
                assert.equal(emit(ev(key)), expected)
            })
        }
    })

    describe('navigation keys', () => {
        const cases: [string, string][] = [
            ['Home', '\x1b[H'],
            ['End', '\x1b[F'],
            ['PageUp', '\x1b[5~'],
            ['PageDown', '\x1b[6~'],
            ['Insert', '\x1b[2~'],
            ['Delete', '\x1b[3~'],
        ]
        for (const [key, expected] of cases) {
            it(`maps "${key}" → ${JSON.stringify(expected)}`, () => {
                assert.equal(emit(ev(key)), expected)
            })
        }
    })

    describe('function keys', () => {
        const cases: [string, string][] = [
            ['F1', '\x1bOP'],
            ['F2', '\x1bOQ'],
            ['F3', '\x1bOR'],
            ['F4', '\x1bOS'],
            ['F5', '\x1b[15~'],
            ['F6', '\x1b[17~'],
            ['F7', '\x1b[18~'],
            ['F8', '\x1b[19~'],
            ['F9', '\x1b[20~'],
            ['F10', '\x1b[21~'],
            ['F11', '\x1b[23~'],
            ['F12', '\x1b[24~'],
        ]
        for (const [key, expected] of cases) {
            it(`maps "${key}" → ${JSON.stringify(expected)}`, () => {
                assert.equal(emit(ev(key)), expected)
            })
        }
    })

    describe('Ctrl modifier', () => {
        it('Ctrl+A → 0x01', () => {
            assert.equal(emit(ev('a', { ctrlKey: true })), '\x01')
        })

        it('Ctrl+C → 0x03 (SIGINT)', () => {
            assert.equal(emit(ev('c', { ctrlKey: true })), '\x03')
        })

        it('Ctrl+D → 0x04 (EOF)', () => {
            assert.equal(emit(ev('d', { ctrlKey: true })), '\x04')
        })

        it('Ctrl+Z → 0x1a (SIGTSTP)', () => {
            assert.equal(emit(ev('z', { ctrlKey: true })), '\x1a')
        })

        it('Ctrl+M → 0x0d (CR, same as Enter)', () => {
            assert.equal(emit(ev('m', { ctrlKey: true })), '\r')
        })

        it('Ctrl+[ → 0x1b (same as Escape)', () => {
            assert.equal(emit(ev('[', { ctrlKey: true })), '\x1b')
        })

        it('Ctrl+] → 0x1d', () => {
            assert.equal(emit(ev(']', { ctrlKey: true })), '\x1d')
        })

        it('Ctrl+\\ → 0x1c', () => {
            assert.equal(emit(ev('\\', { ctrlKey: true })), '\x1c')
        })

        it('Ctrl+Space → 0x00 (NUL)', () => {
            assert.equal(emit(ev(' ', { ctrlKey: true })), '\x00')
        })

        it('uppercase letter with Ctrl also works (Ctrl+Shift+A)', () => {
            assert.equal(emit(ev('A', { ctrlKey: true })), '\x01')
        })
    })

    describe('Alt modifier (ESC prefix)', () => {
        it('Alt+a → ESC + a', () => {
            assert.equal(emit(ev('a', { altKey: true })), '\x1ba')
        })

        it('Alt+Backspace → ESC + DEL', () => {
            assert.equal(emit(ev('Backspace', { altKey: true })), '\x1b\x7f')
        })

        it('Alt+Enter → ESC + CR', () => {
            assert.equal(emit(ev('Enter', { altKey: true })), '\x1b\r')
        })
    })

    describe('unknown key', () => {
        it('returns empty for unrecognised non-printable', () => {
            assert.equal(emit(ev('ScrollLock')), '')
            assert.equal(emit(ev('NumLock')), '')
            assert.equal(emit(ev('ContextMenu')), '')
        })
    })
})
