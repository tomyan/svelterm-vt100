/**
 * CSS gradient renderings for Unicode block-element characters
 * (U+2580–U+259F). Rendering these via gradients — rather than relying on a
 * font to rasterise them — side-steps the rounding artefacts and missing-
 * glyph fallbacks that plague these characters at small pixel sizes.
 *
 * Returns `null` for characters outside the block-element range.
 */
export function blockGlyphBackground(codepoint: number, color: string): string | null {
    const lower = (pct: number) => `linear-gradient(to top, ${color} ${pct}%, transparent ${pct}%)`
    const left  = (pct: number) => `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`
    switch (codepoint) {
        case 0x2581: return lower(12.5)   // ▁
        case 0x2582: return lower(25)     // ▂
        case 0x2583: return lower(37.5)   // ▃
        case 0x2584: return lower(50)     // ▄
        case 0x2585: return lower(62.5)   // ▅
        case 0x2586: return lower(75)     // ▆
        case 0x2587: return lower(87.5)   // ▇
        case 0x2588: return `linear-gradient(${color}, ${color})`  // █
        case 0x2589: return left(87.5)    // ▉
        case 0x258A: return left(75)      // ▊
        case 0x258B: return left(62.5)    // ▋
        case 0x258C: return left(50)      // ▌
        case 0x258D: return left(37.5)    // ▍
        case 0x258E: return left(25)      // ▎
        case 0x258F: return left(12.5)    // ▏
        case 0x2590: return `linear-gradient(to left, ${color} 50%, transparent 50%)`    // ▐
        case 0x2594: return `linear-gradient(to bottom, ${color} 12.5%, transparent 12.5%)` // ▔
        case 0x2595: return `linear-gradient(to left, ${color} 12.5%, transparent 12.5%)`   // ▕
        case 0x2580: return `linear-gradient(to bottom, ${color} 50%, transparent 50%)`  // ▀
        case 0x2596: return quadrant(color, false, false, true, false)   // ▖
        case 0x2597: return quadrant(color, false, false, false, true)   // ▗
        case 0x2598: return quadrant(color, true, false, false, false)   // ▘
        case 0x259D: return quadrant(color, false, true, false, false)   // ▝
        case 0x2599: return quadrant(color, true, false, true, true)     // ▙
        case 0x259B: return quadrant(color, true, true, true, false)     // ▛
        case 0x259C: return quadrant(color, true, true, false, true)     // ▜
        case 0x259F: return quadrant(color, false, true, true, true)     // ▟
        case 0x259A: return quadrant(color, true, false, false, true)    // ▚
        case 0x259E: return quadrant(color, false, true, true, false)    // ▞
        case 0x2591: return `linear-gradient(${color}, ${color})`  // ░
        case 0x2592: return `linear-gradient(${color}, ${color})`  // ▒
        case 0x2593: return `linear-gradient(${color}, ${color})`  // ▓
    }
    return null
}

function quadrant(color: string, tl: boolean, tr: boolean, bl: boolean, br: boolean): string {
    const layers: string[] = []
    const add = (fill: boolean, bgPos: string) => {
        if (fill) layers.push(`linear-gradient(${color}, ${color}) ${bgPos} / 50% 50% no-repeat`)
    }
    add(tl, 'top left')
    add(tr, 'top right')
    add(bl, 'bottom left')
    add(br, 'bottom right')
    return layers.join(', ')
}

/**
 * Shading blocks (░ ▒ ▓) render as solid fills with reduced opacity — a
 * cheap approximation of the dot-matrix pattern that reads fine at
 * terminal-cell sizes.
 */
export function blockGlyphOpacity(codepoint: number): number | null {
    switch (codepoint) {
        case 0x2591: return 0.25
        case 0x2592: return 0.5
        case 0x2593: return 0.75
    }
    return null
}
