/**
 * ConsoleP2PClient
 *
 * High-level client that ties together `ConsoleInterceptor`, `P2pMessageHelper`,
 * and `P2PSignalingClient` to provide a simple, app-facing interface for
 * forwarding console output over P2P connections.
 *
 * **Sending side** (the app whose console you want to forward):
 * ```js
 * const client = new ConsoleP2PClient('ws://localhost:3000', { room: 'my-room' });
 * client.connect();
 * client.start();  // patches the global console
 * // every console.log/warn/error/... is now forwarded to connected peers
 * client.stop();   // restores the original console
 * client.disconnect();
 * ```
 *
 * **Viewing side** (the app that receives and displays remote console output):
 * ```js
 * const viewer = new ConsoleP2PClient('ws://localhost:3000', { room: 'my-room' });
 * viewer.onConsoleMessage((peerId, msg) => {
 *   console.log(`[${msg.level}] from ${peerId}:`, msg.text);
 * });
 * viewer.connect();
 * ```
 *
 * Both sides use the same class; a single instance can both forward and receive.
 */
export class ConsoleP2PClient {
    /**
     * Create a ConsoleP2PClient.
     *
     * @param {string} signalingServerUrl - WebSocket URL of the signaling server.
     * @param {Object} [options={}] - Optional configuration.
     * @param {string} [options.room] - Room to join automatically on connection.
     * @param {string} [options.namespace] - Namespace tag included in every forwarded message.
     */
    constructor(signalingServerUrl: string, options?: {
        room?: string;
        namespace?: string;
    });
    /**
     * Underlying signaling client that manages P2P connections.
     * @type {P2PSignalingClient}
     * @private
     */
    private _signalingClient;
    /**
     * Console interceptor used to monkey-patch and restore global console.
     * @type {ConsoleInterceptor}
     * @private
     */
    private _interceptor;
    /**
     * Message helper used to build structured message objects from console calls.
     * @type {P2pMessageHelper}
     * @private
     */
    private _helper;
    /**
     * Handlers called when a console message is received from a remote peer.
     * @type {Array<function(string, Object):void>}
     * @private
     */
    private _consoleMessageHandlers;
    /**
     * Whether console forwarding is currently active.
     * @type {boolean}
     * @private
     */
    private _active;
    /**
     * Open the connection to the signaling server.
     *
     * @returns {void}
     */
    connect(): void;
    /**
     * Start intercepting the global console and forwarding every call to all
     * peers that are currently in the same room.
     *
     * If already active this is a no-op.
     *
     * @returns {void}
     */
    start(): void;
    /**
     * Stop intercepting the console. Restores original console methods.
     *
     * If not currently active this is a no-op.
     *
     * @returns {void}
     */
    stop(): void;
    /**
     * Stop console forwarding and close all P2P connections and the signaling
     * WebSocket.
     *
     * @returns {void}
     */
    disconnect(): void;
    /**
     * Whether the console is currently being forwarded to remote peers.
     *
     * @type {boolean}
     */
    get isActive(): boolean;
    /**
     * The room this client is currently in (or null).
     *
     * @type {string|null}
     */
    get currentRoom(): string | null;
    /**
     * The server-assigned ID for this client (or null until assigned).
     *
     * @type {string|null}
     */
    get currentServerID(): string | null;
    /**
     * Register a handler that is called whenever a console message is received
     * from a remote peer.
     *
     * The message object has the shape produced by `P2pMessageHelper.buildMessage`:
     * `{ id, level, namespace, timestamp, payload, text }`.
     *
     * @param {function(string, Object):void} handler - Called with (peerId, messageObject).
     * @returns {void}
     */
    onConsoleMessage(handler: (arg0: string, arg1: any) => void): void;
    /**
     * Register a handler for general signaling errors.
     *
     * @param {function(Error):void} handler
     * @returns {void}
     */
    onError(handler: (arg0: Error) => void): void;
    /**
     * Register a handler for peer-specific errors.
     *
     * @param {function(string, Error):void} handler
     * @returns {void}
     */
    onPeerError(handler: (arg0: string, arg1: Error) => void): void;
    /**
     * Join a room on the signaling server.
     *
     * @param {string} roomName
     * @returns {boolean} True if the request was sent.
     */
    joinRoom(roomName: string): boolean;
    /**
     * Leave the current room.
     *
     * @returns {boolean} True if the request was sent.
     */
    leaveRoom(): boolean;
    /**
     * Get the IDs of peers currently in the room.
     *
     * @returns {Array<string>}
     */
    getRoomPeers(): Array<string>;
    /**
     * Whether the signaling WebSocket is currently open.
     *
     * @returns {boolean}
     */
    isConnected(): boolean;
    /**
     * Get the current WebSocket connection state string.
     *
     * @returns {string} One of: 'connecting', 'open', 'closing', 'closed', 'disconnected'
     */
    getConnectionState(): string;
}
