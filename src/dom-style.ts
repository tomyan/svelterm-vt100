/**
 * Style-string builders used by the DOM renderer. Extracted as pure
 * functions so they can be unit-tested without a DOM.
 */

/**
 * Return the base CSS declarations every span needs: an inline-block
 * with overflow clipped to its own box and an explicit line-height
 * matching the row height. This prevents glyph overflow from leaking
 * between cells and adjacent rows (the font's ascent+descent can
 * otherwise paint over neighbouring spans).
 */
export function baseSpanStyle(rowHeightPx: number): string {
    return `display:inline-block;overflow:clip;height:${rowHeightPx}px;line-height:${rowHeightPx}px;vertical-align:top`
}

/**
 * Compose the final style string for a span. If additional declarations
 * (color, bg, bold, etc.) are provided, they're appended.
 */
export function composeSpanStyle(rowHeightPx: number, extra: string): string {
    const base = baseSpanStyle(rowHeightPx)
    return extra ? `${base};${extra}` : base
}
