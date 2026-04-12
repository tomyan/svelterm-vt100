import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal } from '../src/terminal.js'

describe('OSC 11 background color query', () => {
    it('responds with background color on OSC 11 query', () => {
        const t = new Terminal(80, 24)
        t.backgroundColor = '#0d1117'
        let response = ''
        t.onResponse = (data) => { response = data }

        t.write('\x1b]11;?\x07')

        assert.ok(response.length > 0, 'should have received a response')
        assert.ok(response.startsWith('\x1b]11;rgb:'), `response should start with OSC 11 rgb, got: ${JSON.stringify(response)}`)
        assert.ok(response.endsWith('\x07'), 'response should end with BEL')
    })

    it('responds with correct RGB for dark background', () => {
        const t = new Terminal(80, 24)
        t.backgroundColor = '#0d1117'
        let response = ''
        t.onResponse = (data) => { response = data }

        t.write('\x1b]11;?\x07')

        assert.equal(response, '\x1b]11;rgb:0d0d/1111/1717\x07')
    })

    it('responds with correct RGB for light background', () => {
        const t = new Terminal(80, 24)
        t.backgroundColor = '#ffffff'
        let response = ''
        t.onResponse = (data) => { response = data }

        t.write('\x1b]11;?\x07')

        assert.equal(response, '\x1b]11;rgb:ffff/ffff/ffff\x07')
    })

    it('does not respond if onResponse is not set', () => {
        const t = new Terminal(80, 24)
        // No onResponse set — should not throw
        t.write('\x1b]11;?\x07')
    })
})
