/**
 * P2P signaling client that bridges a WebSocket-based signaling server and local P2P connections.
 *
 * Responsibilities:
 * - Maintain a collection of P2P connections keyed by remote peer id.
 * - Route signaling messages (offer/answer/ice-candidate) received via a signaling WebSocket
 *   to the appropriate P2P connection.
 * - Forward local signaling events (offer/answer/ice candidates) from P2P connections
 *   to the signaling server.
 *
 * Usage:
 * const client = new P2PSignalingClient(signalingUrl);
 * client.connect();
 * client.initiateP2P(remoteId).then(offer => { ... });
 */
export class P2PSignalingClient {
    /**
     * Create a P2P signaling client.
     *
     * @param {string} signalingServerUrl - WebSocket URL of the signaling server.
     * @param {Object} [options={}] - Optional configuration.
     * @param {string} [options.room] - Room name to join on connection.
     */
    constructor(signalingServerUrl: string, options?: {
        room?: string;
    });
    /**
     * WebSocket connector instance used to communicate with the signaling server.
     * @type {WebSocketConnector}
     */
    ws: WebSocketConnector;
    /**
     * Map of remotePeerId -> P2PConnection instances.
     * @type {Map<string, P2PConnection>}
     */
    peers: Map<string, P2PConnection>;
    /**
     * The id assigned by the signaling server for this client (if provided).
     * @type {string|null}
     */
    currentServerID: string | null;
    /**
     * The room this client is currently in.
     * @type {string|null}
     */
    currentRoom: string | null;
    /**
     * List of peer IDs in the current room.
     * @type {Array<string>}
     */
    roomPeers: Array<string>;
    /**
     * Error event handlers.
     * @type {Array<function(Error):void>}
     */
    onErrorHandlers: Array<(arg0: Error) => void>;
    /**
     * Peer error handlers - called when a specific peer connection fails.
     * Examples: connection establishment failures, offer/answer processing errors,
     * WebSocket send failures for signaling messages.
     * @type {Array<function(string, Error):void>}
     */
    onPeerErrorHandlers: Array<(arg0: string, arg1: Error) => void>;
    /**
     * Handlers invoked when any connected peer sends an application-level
     * message over the P2P data channel.
     * @type {Array<function(string, string):void>}
     */
    onPeerMessageHandlers: Array<(arg0: string, arg1: string) => void>;
    /**
     * Wire WebSocket events to parse and forward incoming signaling messages.
     * Sets up:
     * - onMessage: parse JSON and delegate to handleSignalingMessage
     * - onOpen: log connection established
     *
     * @private
     * @returns {void}
     */
    private setupSignaling;
    /**
     * Create and wire a P2PConnection for a specific remote peer id.
     * If one already exists, returns it.
     *
     * The created P2PConnection will forward its local signaling events (offer, answer, ice)
     * to the signaling server with the `to` field set to `remotePeerId`.
     * It also logs application-level messages and connection events.
     *
     * @private
     * @param {string} remotePeerId - Identifier of the remote peer.
     * @returns {P2PConnection} The P2PConnection instance associated with the remote peer.
     */
    private createP2PConnection;
    /**
     * Handle signaling messages and route them to the correct P2PConnection.
     *
     * Expected `data.from` to identify the remote peer for offer/answer/ice-candidate messages.
     *
     * Supported message shapes:
     * - { type: "offer", from: "<peerId>", offer: {...} }
     * - { type: "answer", from: "<peerId>", answer: {...} }
     * - { type: "ice-candidate", from: "<peerId>", candidate: {...} }
     * - { type: "id", id: "<serverAssignedId>" }
     * - { type: "room-joined", room: "<roomName>" }
     * - { type: "room-left", room: "<roomName>" }
     * - { type: "room-peers", peers: ["<peerId1>", "<peerId2>", ...] }
     * - { type: "peer-joined", peerId: "<peerId>" }
     * - { type: "peer-left", peerId: "<peerId>" }
     * - { type: "error", message: "<errorMessage>" }
     *
     * @param {Object} data - Parsed signaling message.
     * @returns {void}
     */
    handleSignalingMessage(data: any): void;
    /**
     * Open the signaling WebSocket connection.
     *
     * @returns {void}
     */
    connect(): void;
    /**
     * Join a room on the signaling server.
     *
     * @param {string} roomName - Name of the room to join.
     * @returns {boolean} True if the join request was sent, false otherwise.
     */
    joinRoom(roomName: string): boolean;
    /**
     * Leave the current room on the signaling server.
     *
     * @returns {boolean} True if the leave request was sent, false otherwise.
     */
    leaveRoom(): boolean;
    /**
     * Get the list of peers in the current room.
     *
     * @returns {Array<string>} Array of peer IDs in the current room.
     */
    getRoomPeers(): Array<string>;
    /**
     * Initiate a P2P connection to a remote peer.
     *
     * Creates (or reuses) a P2PConnection and calls its `initiate()` method which
     * typically creates a local SDP offer and returns it.
     *
     * @param {string} remotePeerId - Identifier of the peer to initiate a connection with.
     * @returns {Promise<Object>} Resolves with the created SDP offer object, or rejects on error.
     */
    initiateP2P(remotePeerId: string): Promise<any>;
    /**
     * Send an application-level message over a specific P2P data channel.
     *
     * Usage:
     * - sendMessage(remotePeerId, message)
     * - sendMessage(message) -> sends to the first connected peer (backward compatibility)
     *
     * @param {string|Object} remotePeerIdOrMessage - remotePeerId when sending to a specific peer, or the message payload when using single-arg form.
     * @param {string|Object} [message] - Message payload when using two-arg form.
     * @returns {boolean} True if the message was sent, false otherwise.
     */
    sendMessage(remotePeerIdOrMessage: string | any, message?: string | any): boolean;
    /**
     * Disconnect a specific peer connection and remove it from the peers map.
     *
     * @param {string} remotePeerId - Identifier of the peer to disconnect.
     * @returns {void}
     */
    disconnectPeer(remotePeerId: string): void;
    /**
     * Close all P2P connections and the signaling WebSocket.
     *
     * Ensures per-peer `close()` is called and clears internal state.
     *
     * @returns {void}
     */
    disconnect(): void;
    /**
     * Force an immediate reconnection to the signaling server.
     * Closes all P2P connections and reconnects the WebSocket.
     *
     * @returns {void}
     */
    forceReconnect(): void;
    /**
     * Get the current WebSocket connection state.
     *
     * @returns {string} One of: 'connecting', 'open', 'closing', 'closed', 'disconnected'
     */
    getConnectionState(): string;
    /**
     * Set the WebSocket reconnection interval.
     *
     * @param {number} intervalMs - Milliseconds to wait before reconnecting after close.
     * @returns {void}
     */
    setReconnectInterval(intervalMs: number): void;
    /**
     * Enable automatic reconnection for the WebSocket.
     *
     * @returns {void}
     */
    enableAutoReconnect(): void;
    /**
     * Disable automatic reconnection for the WebSocket.
     *
     * @returns {void}
     */
    disableAutoReconnect(): void;
    /**
     * Check if the WebSocket is currently connected.
     *
     * @returns {boolean} True if connected, false otherwise.
     */
    isConnected(): boolean;
    /**
     * Register a callback to be executed when the signaling WebSocket is ready.
     *
     * Delegates to the underlying WebSocketConnector's `whenReady` method.
     * Wraps the callback to catch and handle errors gracefully.
     *
     * @param {Function} callback - Callback to execute when WS is ready.
     * @returns {void}
     */
    whenConnected(callback: Function): void;
    /**
     * Register a handler for general errors.
     *
     * @param {function(Error):void} handler - Called when an error occurs.
     * @returns {void}
     */
    onError(handler: (arg0: Error) => void): void;
    /**
     * Register a handler for peer-specific errors.
     *
     * @param {function(string, Error):void} handler - Called when a peer connection error occurs.
     * @returns {void}
     */
    onPeerError(handler: (arg0: string, arg1: Error) => void): void;
    /**
     * Register a handler invoked whenever any connected peer sends an
     * application-level message over the P2P data channel.
     *
     * @param {function(string, string):void} handler - Called with (peerId, rawMessage).
     * @returns {void}
     */
    onPeerMessage(handler: (arg0: string, arg1: string) => void): void;
    /**
     * Emit a general error to all registered error handlers.
     *
     * @private
     * @param {Error} error - The error to emit.
     * @returns {void}
     */
    private emitError;
    /**
     * Emit a peer-specific error to all registered peer error handlers.
     *
     * @private
     * @param {string} peerId - The peer ID associated with the error.
     * @param {Error} error - The error to emit.
     * @returns {void}
     */
    private emitPeerError;
}
import { WebSocketConnector } from "./websocket-connector.js";
import { P2PConnection } from "./p2p-connection.js";
