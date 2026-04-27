/**
 * A bidirectional byte stream with viewport-size coordination — the
 * abstraction `EmbeddedTerminal` consumes. Adapters bridge specific
 * sources to this shape: a PTY, a v86 UART, a WebSocket, an in-process
 * peer, a recorded session.
 *
 * Bytes are always `Uint8Array`. No string encoding at the boundary —
 * partial UTF-8 sequences across writes would break a string boundary,
 * which is exactly why `Terminal.write` accepts bytes and runs them
 * through a streaming TextDecoder.
 *
 * Lifecycle: a single `onClose(reason)` channel — `null` for clean
 * end (process exited normally, peer closed cleanly), an `Error` for
 * a transport failure or source crash. No separate `onError`.
 *
 * Buffering: bytes emitted before the first `onOutput` subscriber are
 * buffered and delivered to that subscriber on subscribe. Adapters
 * shouldn't lose data because of subscribe-order races (e.g. v86
 * boots and starts writing the first ms of output before a consumer
 * has had time to attach).
 */
export interface TerminalStream {
    /**
     * Subscribe to bytes flowing from the source toward the terminal.
     * Returns an unsubscribe function.
     */
    onOutput(listener: (bytes: Uint8Array) => void): () => void

    /**
     * Send bytes to the source (e.g. keystrokes from the user, encoded
     * via `keyEventToBytes`). Silent no-op after close.
     */
    write(bytes: Uint8Array): void

    /**
     * Notify the source of viewport-size changes. The first call sets
     * the initial size; subsequent calls are resizes. Implementations
     * forward to the source's notion of viewport — PTY via TIOCSWINSZ
     * + SIGWINCH, WebSocket via a protocol message, an in-process
     * peer to its own consumer.
     */
    resize(cols: number, rows: number): void

    /**
     * Subscribe to stream-end. Fires once. `reason` is `null` for clean
     * end, an `Error` for transport failure or source crash. Returns
     * an unsubscribe function.
     */
    onClose(listener: (reason: Error | null) => void): () => void

    /**
     * Close the stream from the consumer side. Stops accepting writes,
     * fires `onClose` listeners with `reason=null`. Idempotent.
     */
    close(): void
}
