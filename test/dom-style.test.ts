import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { baseSpanStyle, composeSpanStyle } from '../src/dom-style.js'

describe('baseSpanStyle', () => {
    it('makes spans inline-block with clipped overflow', () => {
        // Given
        const rowHeight = 13

        // When
        const style = baseSpanStyle(rowHeight)

        // Then
        assert.ok(style.includes('display:inline-block'), 'must be inline-block')
        assert.ok(style.includes('overflow:clip'), 'must clip overflow')
    })

    it('sets explicit height and line-height matching the row', () => {
        // Given
        const rowHeight = 17

        // When
        const style = baseSpanStyle(rowHeight)

        // Then
        assert.ok(style.includes('height:17px'), 'must have explicit height')
        assert.ok(style.includes('line-height:17px'), 'must have matching line-height')
    })

    it('anchors the span to the top of the line box', () => {
        // When
        const style = baseSpanStyle(13)

        // Then
        assert.ok(style.includes('vertical-align:top'), 'must align top')
    })
})

describe('composeSpanStyle', () => {
    it('returns just the base style when no extra is provided', () => {
        // Given
        const rowHeight = 13

        // When
        const style = composeSpanStyle(rowHeight, '')

        // Then
        assert.equal(style, baseSpanStyle(rowHeight))
    })

    it('appends extra declarations after the base', () => {
        // Given
        const extra = 'color:red;background-color:blue'

        // When
        const style = composeSpanStyle(13, extra)

        // Then
        assert.ok(style.endsWith(';color:red;background-color:blue'))
        assert.ok(style.startsWith('display:inline-block'))
    })
})
