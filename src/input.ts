export interface KeyInput {
    key: string
    ctrlKey?: boolean
    altKey?: boolean
    shiftKey?: boolean
    metaKey?: boolean
}

const encoder = new TextEncoder()

const SPECIAL: Record<string, string> = {
    Enter: '\r',
    Tab: '\t',
    Backspace: '\x7f',
    Escape: '\x1b',
    ArrowUp: '\x1b[A',
    ArrowDown: '\x1b[B',
    ArrowRight: '\x1b[C',
    ArrowLeft: '\x1b[D',
    Home: '\x1b[H',
    End: '\x1b[F',
    PageUp: '\x1b[5~',
    PageDown: '\x1b[6~',
    Insert: '\x1b[2~',
    Delete: '\x1b[3~',
    F1: '\x1bOP',
    F2: '\x1bOQ',
    F3: '\x1bOR',
    F4: '\x1bOS',
    F5: '\x1b[15~',
    F6: '\x1b[17~',
    F7: '\x1b[18~',
    F8: '\x1b[19~',
    F9: '\x1b[20~',
    F10: '\x1b[21~',
    F11: '\x1b[23~',
    F12: '\x1b[24~',
}

function ctrlChar(key: string): string | null {
    const code = key.toLowerCase().charCodeAt(0)
    if (code >= 0x61 && code <= 0x7a) return String.fromCharCode(code - 0x60)
    switch (key) {
        case '[': return '\x1b'
        case '\\': return '\x1c'
        case ']': return '\x1d'
        case '^': return '\x1e'
        case '_': return '\x1f'
        case ' ': return '\x00'
        case '?': return '\x7f'
    }
    return null
}

function resolveString(event: KeyInput): string {
    const { key } = event
    const altPrefix = event.altKey ? '\x1b' : ''

    if (event.ctrlKey && !event.metaKey && key.length === 1) {
        const ctrl = ctrlChar(key)
        if (ctrl !== null) return altPrefix + ctrl
    }

    const special = SPECIAL[key]
    if (special !== undefined) return altPrefix + special

    if (key.length === 1) return altPrefix + key

    return ''
}

export function keyEventToBytes(event: KeyInput): Uint8Array {
    return encoder.encode(resolveString(event))
}
