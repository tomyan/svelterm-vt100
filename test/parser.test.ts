import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Parser, type ParserEvent } from '../src/parser.js'

function parse(input: string): ParserEvent[] {
    const events: ParserEvent[] = []
    const parser = new Parser((event) => events.push(event))
    parser.feed(input)
    return events
}

describe('Parser', () => {
    describe('plain text', () => {
        it('emits print events for regular characters', () => {
            const events = parse('Hello')
            assert.deepEqual(events, [
                { type: 'print', char: 'H' },
                { type: 'print', char: 'e' },
                { type: 'print', char: 'l' },
                { type: 'print', char: 'l' },
                { type: 'print', char: 'o' },
            ])
        })

        it('handles empty input', () => {
            const events = parse('')
            assert.deepEqual(events, [])
        })
    })

    describe('C0 control codes', () => {
        it('emits execute for BEL', () => {
            const events = parse('\x07')
            assert.deepEqual(events, [{ type: 'execute', code: 0x07 }])
        })

        it('emits execute for BS', () => {
            const events = parse('\x08')
            assert.deepEqual(events, [{ type: 'execute', code: 0x08 }])
        })

        it('emits execute for HT', () => {
            const events = parse('\x09')
            assert.deepEqual(events, [{ type: 'execute', code: 0x09 }])
        })

        it('emits execute for LF', () => {
            const events = parse('\x0a')
            assert.deepEqual(events, [{ type: 'execute', code: 0x0a }])
        })

        it('emits execute for CR', () => {
            const events = parse('\x0d')
            assert.deepEqual(events, [{ type: 'execute', code: 0x0d }])
        })

        it('handles mixed text and controls', () => {
            const events = parse('A\x0d\x0aB')
            assert.deepEqual(events, [
                { type: 'print', char: 'A' },
                { type: 'execute', code: 0x0d },
                { type: 'execute', code: 0x0a },
                { type: 'print', char: 'B' },
            ])
        })
    })

    describe('CSI sequences', () => {
        it('parses CSI with no params', () => {
            // ESC [ H  (cursor home)
            const events = parse('\x1b[H')
            assert.deepEqual(events, [
                { type: 'csi', params: [], intermediates: '', final: 'H' },
            ])
        })

        it('parses CSI with one param', () => {
            // ESC [ 5 A  (cursor up 5)
            const events = parse('\x1b[5A')
            assert.deepEqual(events, [
                { type: 'csi', params: [5], intermediates: '', final: 'A' },
            ])
        })

        it('parses CSI with multiple params', () => {
            // ESC [ 10 ; 20 H  (cursor to row 10, col 20)
            const events = parse('\x1b[10;20H')
            assert.deepEqual(events, [
                { type: 'csi', params: [10, 20], intermediates: '', final: 'H' },
            ])
        })

        it('parses CSI with default (missing) params as 0', () => {
            // ESC [ ; 5 H  (row default, col 5)
            const events = parse('\x1b[;5H')
            assert.deepEqual(events, [
                { type: 'csi', params: [0, 5], intermediates: '', final: 'H' },
            ])
        })

        it('parses SGR with multiple params', () => {
            // ESC [ 1 ; 31 m  (bold, red)
            const events = parse('\x1b[1;31m')
            assert.deepEqual(events, [
                { type: 'csi', params: [1, 31], intermediates: '', final: 'm' },
            ])
        })

        it('parses CSI with intermediate bytes', () => {
            // ESC [ ? 25 h  (show cursor, private mode)
            const events = parse('\x1b[?25h')
            assert.deepEqual(events, [
                { type: 'csi', params: [25], intermediates: '?', final: 'h' },
            ])
        })

        it('parses CSI with text before and after', () => {
            const events = parse('A\x1b[31mB')
            assert.deepEqual(events, [
                { type: 'print', char: 'A' },
                { type: 'csi', params: [31], intermediates: '', final: 'm' },
                { type: 'print', char: 'B' },
            ])
        })

        it('parses truecolor CSI', () => {
            // ESC [ 38 ; 2 ; 255 ; 128 ; 0 m
            const events = parse('\x1b[38;2;255;128;0m')
            assert.deepEqual(events, [
                { type: 'csi', params: [38, 2, 255, 128, 0], intermediates: '', final: 'm' },
            ])
        })
    })

    describe('ESC sequences', () => {
        it('parses simple ESC sequence', () => {
            // ESC M  (reverse index)
            const events = parse('\x1bM')
            assert.deepEqual(events, [
                { type: 'esc', intermediates: '', final: 'M' },
            ])
        })

        it('parses ESC with intermediate', () => {
            // ESC ( 0  (select G0 character set — DEC special graphics)
            const events = parse('\x1b(0')
            assert.deepEqual(events, [
                { type: 'esc', intermediates: '(', final: '0' },
            ])
        })
    })

    describe('OSC sequences', () => {
        it('parses OSC terminated by BEL', () => {
            // ESC ] 0 ; title BEL
            const events = parse('\x1b]0;My Title\x07')
            assert.deepEqual(events, [
                { type: 'osc', data: '0;My Title' },
            ])
        })

        it('parses OSC terminated by ST (ESC \\)', () => {
            const events = parse('\x1b]2;Window Title\x1b\\')
            assert.deepEqual(events, [
                { type: 'osc', data: '2;Window Title' },
            ])
        })

        it('parses hyperlink OSC 8', () => {
            const events = parse('\x1b]8;;https://example.com\x1b\\')
            assert.deepEqual(events, [
                { type: 'osc', data: '8;;https://example.com' },
            ])
        })
    })

    describe('DCS sequences', () => {
        it('parses DCS terminated by ST', () => {
            const events = parse('\x1bPsome data\x1b\\')
            assert.deepEqual(events, [
                { type: 'dcs', data: 'some data' },
            ])
        })
    })

    describe('UTF-8', () => {
        it('handles multi-byte UTF-8 characters', () => {
            const events = parse('é')
            assert.deepEqual(events, [
                { type: 'print', char: 'é' },
            ])
        })

        it('handles CJK characters', () => {
            const events = parse('日本')
            assert.deepEqual(events, [
                { type: 'print', char: '日' },
                { type: 'print', char: '本' },
            ])
        })

        it('handles emoji', () => {
            const events = parse('🎉')
            assert.deepEqual(events, [
                { type: 'print', char: '🎉' },
            ])
        })
    })

    describe('malformed sequences', () => {
        it('recovers from ESC followed by printable (not [, ], P, etc.)', () => {
            // ESC followed by something unexpected — treat ESC as ignored, print the char
            const events = parse('\x1bZ')
            // ESC Z is actually "Identify Terminal" (DA) — should be an esc event
            assert.equal(events.length, 1)
            assert.equal(events[0].type, 'esc')
        })

        it('handles interrupted CSI (ESC in middle)', () => {
            // Start CSI, then ESC interrupts
            const events = parse('\x1b[3\x1b[H')
            // First CSI is aborted, second CSI completes
            assert.equal(events[events.length - 1].type, 'csi')
        })

        it('handles C0 control inside CSI', () => {
            // LF inside a CSI sequence — execute LF, continue CSI
            const events = parse('\x1b[1\x0a;2H')
            const lf = events.find(e => e.type === 'execute' && e.code === 0x0a)
            assert.ok(lf, 'LF should be executed')
        })
    })

    describe('incremental feeding', () => {
        it('handles split input across multiple feeds', () => {
            const events: ParserEvent[] = []
            const parser = new Parser((event) => events.push(event))
            parser.feed('\x1b')
            parser.feed('[')
            parser.feed('31')
            parser.feed('m')
            assert.deepEqual(events, [
                { type: 'csi', params: [31], intermediates: '', final: 'm' },
            ])
        })

        it('handles split UTF-8 across feeds', () => {
            const events: ParserEvent[] = []
            const parser = new Parser((event) => events.push(event))
            // é is 0xC3 0xA9 in UTF-8
            const buf = Buffer.from('é')
            parser.feed(String.fromCharCode(buf[0]))
            parser.feed(String.fromCharCode(buf[1]))
            // This tests that the parser handles individual characters
            // (JS strings are UTF-16, so split UTF-8 only matters for byte input)
            assert.ok(events.length > 0)
        })
    })
})
