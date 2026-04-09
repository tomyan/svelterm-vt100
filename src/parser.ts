/**
 * ANSI escape sequence parser.
 *
 * State machine following the VT500-series model. Classifies input into
 * print, execute, CSI, ESC, OSC, and DCS events.
 */

export type ParserEvent =
    | { type: 'print'; char: string }
    | { type: 'execute'; code: number }
    | { type: 'csi'; params: number[]; intermediates: string; final: string }
    | { type: 'esc'; intermediates: string; final: string }
    | { type: 'osc'; data: string }
    | { type: 'dcs'; data: string }

const enum State {
    Ground,
    Escape,
    EscapeIntermediate,
    CsiEntry,
    CsiParam,
    CsiIntermediate,
    OscString,
    DcsString,
}

export class Parser {
    private state = State.Ground
    private emit: (event: ParserEvent) => void

    // CSI accumulation
    private params: number[] = []
    private currentParam = 0
    private hasParam = false
    private intermediates = ''

    // OSC/DCS accumulation
    private stringData = ''

    constructor(emit: (event: ParserEvent) => void) {
        this.emit = emit
    }

    feed(input: string): void {
        for (let i = 0; i < input.length; i++) {
            const code = input.charCodeAt(i)
            // Handle surrogate pairs (emoji, etc.)
            if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
                const low = input.charCodeAt(i + 1)
                if (low >= 0xdc00 && low <= 0xdfff) {
                    const ch = input[i] + input[i + 1]
                    i++
                    this.process(ch, input.codePointAt(i - 1)!)
                    continue
                }
            }
            this.process(input[i], code)
        }
    }

    private process(ch: string, code: number): void {
        switch (this.state) {
            case State.Ground:
                this.handleGround(ch, code)
                break
            case State.Escape:
                this.handleEscape(ch, code)
                break
            case State.EscapeIntermediate:
                this.handleEscapeIntermediate(ch, code)
                break
            case State.CsiEntry:
                this.handleCsiEntry(ch, code)
                break
            case State.CsiParam:
                this.handleCsiParam(ch, code)
                break
            case State.CsiIntermediate:
                this.handleCsiIntermediate(ch, code)
                break
            case State.OscString:
                this.handleOscString(ch, code)
                break
            case State.DcsString:
                this.handleDcsString(ch, code)
                break
        }
    }

    private handleGround(ch: string, code: number): void {
        if (code === 0x1b) {
            this.state = State.Escape
        } else if (isC0(code)) {
            this.emit({ type: 'execute', code })
        } else {
            this.emit({ type: 'print', char: ch })
        }
    }

    private handleEscape(ch: string, code: number): void {
        if (ch === '[') {
            this.enterCsi()
        } else if (ch === ']') {
            this.stringData = ''
            this.state = State.OscString
        } else if (ch === 'P') {
            this.stringData = ''
            this.state = State.DcsString
        } else if (isIntermediate(code)) {
            this.intermediates = ch
            this.state = State.EscapeIntermediate
        } else if (code >= 0x30 && code <= 0x7e) {
            this.emit({ type: 'esc', intermediates: '', final: ch })
            this.state = State.Ground
        } else if (code === 0x1b) {
            // ESC ESC — stay in escape
        } else if (isC0(code)) {
            this.emit({ type: 'execute', code })
        } else {
            this.state = State.Ground
        }
    }

    private handleEscapeIntermediate(ch: string, code: number): void {
        if (isIntermediate(code)) {
            this.intermediates += ch
        } else if (code >= 0x30 && code <= 0x7e) {
            this.emit({ type: 'esc', intermediates: this.intermediates, final: ch })
            this.intermediates = ''
            this.state = State.Ground
        } else if (code === 0x1b) {
            this.intermediates = ''
            this.state = State.Escape
        } else if (isC0(code)) {
            this.emit({ type: 'execute', code })
        } else {
            this.intermediates = ''
            this.state = State.Ground
        }
    }

    private enterCsi(): void {
        this.params = []
        this.currentParam = 0
        this.hasParam = false
        this.intermediates = ''
        this.state = State.CsiEntry
    }

    private handleCsiEntry(ch: string, code: number): void {
        if (code >= 0x30 && code <= 0x39) {
            this.currentParam = code - 0x30
            this.hasParam = true
            this.state = State.CsiParam
        } else if (ch === ';') {
            this.params.push(0)
            this.state = State.CsiParam
        } else if (isIntermediate(code) || ch === '?' || ch === '>' || ch === '!') {
            this.intermediates += ch
            this.state = State.CsiParam
        } else if (code >= 0x40 && code <= 0x7e) {
            this.emit({ type: 'csi', params: this.params, intermediates: this.intermediates, final: ch })
            this.state = State.Ground
        } else if (code === 0x1b) {
            this.state = State.Escape
        } else if (isC0(code)) {
            this.emit({ type: 'execute', code })
        } else {
            this.state = State.Ground
        }
    }

    private handleCsiParam(ch: string, code: number): void {
        if (code >= 0x30 && code <= 0x39) {
            this.currentParam = this.currentParam * 10 + (code - 0x30)
            this.hasParam = true
        } else if (ch === ';') {
            this.params.push(this.hasParam ? this.currentParam : 0)
            this.currentParam = 0
            this.hasParam = false
        } else if (isIntermediate(code)) {
            if (this.hasParam) this.params.push(this.currentParam)
            this.intermediates += ch
            this.state = State.CsiIntermediate
        } else if (code >= 0x40 && code <= 0x7e) {
            if (this.hasParam) this.params.push(this.currentParam)
            this.emit({ type: 'csi', params: this.params, intermediates: this.intermediates, final: ch })
            this.state = State.Ground
        } else if (code === 0x1b) {
            this.state = State.Escape
        } else if (isC0(code)) {
            this.emit({ type: 'execute', code })
        } else {
            this.state = State.Ground
        }
    }

    private handleCsiIntermediate(ch: string, code: number): void {
        if (isIntermediate(code)) {
            this.intermediates += ch
        } else if (code >= 0x40 && code <= 0x7e) {
            this.emit({ type: 'csi', params: this.params, intermediates: this.intermediates, final: ch })
            this.state = State.Ground
        } else if (code === 0x1b) {
            this.state = State.Escape
        } else if (isC0(code)) {
            this.emit({ type: 'execute', code })
        } else {
            this.state = State.Ground
        }
    }

    private handleOscString(ch: string, code: number): void {
        if (code === 0x07) {
            // BEL terminates OSC
            this.emit({ type: 'osc', data: this.stringData })
            this.state = State.Ground
        } else if (code === 0x1b) {
            // Check for ST (ESC \) — need to peek at next char
            // Store ESC and wait
            this.state = State.OscString
            // We'll handle this by checking for \ in the next character
            this.stringData += '\x1b'
        } else if (ch === '\\' && this.stringData.endsWith('\x1b')) {
            // ST = ESC \ — terminate OSC
            this.stringData = this.stringData.slice(0, -1) // remove trailing ESC
            this.emit({ type: 'osc', data: this.stringData })
            this.state = State.Ground
        } else {
            this.stringData += ch
        }
    }

    private handleDcsString(ch: string, code: number): void {
        if (code === 0x1b) {
            this.stringData += '\x1b'
        } else if (ch === '\\' && this.stringData.endsWith('\x1b')) {
            this.stringData = this.stringData.slice(0, -1)
            this.emit({ type: 'dcs', data: this.stringData })
            this.state = State.Ground
        } else {
            this.stringData += ch
        }
    }
}

function isC0(code: number): boolean {
    return code <= 0x1f && code !== 0x1b
}

function isIntermediate(code: number): boolean {
    return code >= 0x20 && code <= 0x2f
}
