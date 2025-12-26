/**
 * WebSocketConnector
 *
 * Lightweight wrapper around the browser WebSocket API providing:
 * - auto-reconnect support
 * - handler registration for open/message/close/error events
 * - utilities to wait until the socket is ready (one-time handlers / promise)
 *
 * Example usage:
 * const connector = new WebSocketConnector('wss://example.com');
 * connector.onMessage(msg => console.log(msg));
 * connector.connect();
 */
export class WebSocketConnector {
    /**
     * Create a new WebSocketConnector.
     *
     * @param {string} url - WebSocket server URL.
     */
    constructor(url: string);
    /**
     * The WebSocket server URL.
     * @type {string}
     */
    url: string;
    /**
     * Underlying WebSocket instance (or null if not connected).
     * @type {WebSocket|null}
     */
    ws: WebSocket | null;
    /**
     * Registered message handlers. Each receives the raw message data (string).
     * @type {Array<function(string):void>}
     */
    messageHandlers: Array<(arg0: string) => void>;
    /**
     * Handlers invoked on every open event.
     * @type {Array<function(Event):void>}
     */
    onOpenHandlers: Array<(arg0: Event) => void>;
    /**
     * Handlers that run once when the socket next opens (then cleared).
     * Useful for waiting for readiness.
     * @type {Array<function(Event):void>}
     */
    oneTimeOpenHandlers: Array<(arg0: Event) => void>;
    /**
     * Handlers invoked on close events.
     * @type {Array<function(CloseEvent):void>}
     */
    onCloseHandlers: Array<(arg0: CloseEvent) => void>;
    /**
     * Handlers invoked on error events.
     * @type {Array<function(Event):void>}
     */
    onErrorHandlers: Array<(arg0: Event) => void>;
    /**
     * Milliseconds to wait before attempting to reconnect after a close.
     * @type {number}
     */
    reconnectInterval: number;
    /**
     * Whether the connector should attempt automatic reconnection after close.
     * @type {boolean}
     */
    shouldReconnect: boolean;
    /**
     * Open the WebSocket connection and wire up event handlers.
     *
     * - Logs lifecycle events to the console.
     * - For incoming messages, handlers receive the event.data (string).
     * - On close, will auto-reconnect after `reconnectInterval` if `shouldReconnect` is true.
     *
     * @returns {void}
     */
    connect(): void;
    /**
     * Send a message over the WebSocket.
     *
     * - If the message is not a string, it will be JSON serialized.
     * - Returns true when the message was queued for send; false otherwise.
     *
     * @param {string|Object} message - Message payload to send.
     * @returns {boolean} True if sent, false if socket not open.
     */
    send(message: string | any): boolean;
    /**
     * Register a handler for incoming messages.
     *
     * @param {function(string):void} handler - Called with raw message data.
     */
    onMessage(handler: (arg0: string) => void): void;
    /**
     * Register a handler invoked on every open event.
     *
     * @param {function(Event):void} handler
     */
    onOpen(handler: (arg0: Event) => void): void;
    /**
     * Register a handler invoked when the socket closes.
     *
     * @param {function(CloseEvent):void} handler
     */
    onClose(handler: (arg0: CloseEvent) => void): void;
    /**
     * Register a handler invoked on socket errors.
     *
     * @param {function(Event):void} handler
     */
    onError(handler: (arg0: Event) => void): void;
    /**
     * Run a callback when the WebSocket is open and ready.
     *
     * - If already open, the callback runs immediately.
     * - Otherwise the callback will run once after the next open event.
     *
     * @param {function():void} callback - Called when socket is ready.
     */
    whenReady(callback: () => void): void;
    /**
     * Returns a Promise that resolves when the WebSocket becomes open.
     *
     * - Optionally accepts a timeout in milliseconds to reject if not opened in time.
     *
     * @param {number} [timeoutMs=0] - Timeout in ms (0 for no timeout).
     * @returns {Promise<void>} Resolves when socket opens, rejects on timeout.
     */
    waitUntilOpen(timeoutMs?: number): Promise<void>;
    /**
     * Close the WebSocket connection.
     *
     * @param {boolean} [preventReconnect=true] - If true, stops automatic reconnection.
     * @returns {void}
     */
    disconnect(preventReconnect?: boolean): void;
    /**
     * Check whether the underlying WebSocket is currently open.
     *
     * @returns {boolean} True when connected and readyState is WebSocket.OPEN.
     */
    isConnected(): boolean;
}
