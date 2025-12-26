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
     */
    constructor(signalingServerUrl: string);
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
     * Initiate a P2P connection to a remote peer.
     *
     * Creates (or reuses) a P2PConnection and calls its `initiate()` method which
     * typically creates a local SDP offer and returns it.
     *
     * @param {string} remotePeerId - Identifier of the peer to initiate a connection with.
     * @returns {Promise<Object>} Resolves with the created SDP offer object.
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
     * Register a callback to be executed when the signaling WebSocket is ready.
     *
     * Delegates to the underlying WebSocketConnector's `whenReady` method.
     *
     * @param {Function} callback - Callback to execute when WS is ready.
     * @returns {void}
     */
    whenConnected(callback: Function): void;
}
import { WebSocketConnector } from "./websocket-connector.js";
import { P2PConnection } from "./p2p-connection.js";
