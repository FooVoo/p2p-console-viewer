/**
 * P2P signaling client that uses REST polling instead of WebSockets.
 *
 * Communicates with the serverless signaling API exposed by the server
 * variant (`POST /api/join`, `POST /api/leave`, `POST /api/signal`,
 * `GET /api/poll`).
 *
 * Responsibilities:
 * - Maintain a collection of P2P connections keyed by remote peer id.
 * - Poll for signaling messages and route them to the correct P2P connection.
 * - Forward local signaling events (offer/answer/ice candidates) via REST.
 *
 * Usage:
 * ```js
 * const client = new RestSignalingClient('https://example.com');
 * await client.connect({ room: 'my-room' });
 * await client.initiateP2P(remoteId);
 * // …
 * await client.disconnect();
 * ```
 */
export class RestSignalingClient {
    /**
     * Create a REST-based signaling client.
     *
     * @param {string} baseUrl - Base URL of the signaling server (e.g. `https://example.com`).
     * @param {Object} [options={}] - Optional configuration.
     * @param {number} [options.pollIntervalMs=2000] - Milliseconds between poll requests.
     * @param {number} [options.timeoutMs=10000] - Default request timeout.
     */
    constructor(baseUrl: string, options?: {
        pollIntervalMs?: number;
        timeoutMs?: number;
    });
    /**
     * REST client used for HTTP requests.
     * @type {RestClient}
     */
    rest: RestClient;
    /**
     * Map of remotePeerId → P2PConnection instances.
     * @type {Map<string, P2PConnection>}
     */
    peers: Map<string, P2PConnection>;
    /**
     * The id assigned by the signaling server for this client.
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
     * Milliseconds between poll requests.
     * @type {number}
     */
    pollIntervalMs: number;
    /**
     * Timer id for the poll loop (null when not polling).
     * @type {ReturnType<typeof setTimeout>|null}
     * @private
     */
    private _pollTimer;
    /**
     * Whether this client is currently connected (joined a room and polling).
     * @type {boolean}
     * @private
     */
    private _connected;
    /**
     * Error event handlers.
     * @type {Array<function(Error):void>}
     */
    onErrorHandlers: Array<(arg0: Error) => void>;
    /**
     * Peer error handlers.
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
     * Join a room via the REST API and start polling for messages.
     *
     * @param {Object} opts
     * @param {string} opts.room - Room name to join.
     * @returns {Promise<{id: string, room: string, peers: string[]}>}
     */
    connect({ room }?: {
        room: string;
    }): Promise<{
        id: string;
        room: string;
        peers: string[];
    }>;
    /**
     * Leave the current room and stop polling.
     *
     * @returns {Promise<void>}
     */
    disconnect(): Promise<void>;
    /**
     * Start the periodic poll loop.
     * @private
     */
    private _startPolling;
    /**
     * Schedule the next poll tick.
     * @private
     */
    private _schedulePoll;
    /**
     * Stop the poll loop.
     * @private
     */
    private _stopPolling;
    /**
     * Execute a single poll request and process any received messages.
     * @private
     * @returns {Promise<void>}
     */
    private _poll;
    /**
     * Handle an incoming signaling message from the server.
     *
     * Supported types mirror the WebSocket variant:
     * - offer / answer / ice-candidate (forwarded to the correct P2PConnection)
     * - peer-joined / peer-left (room membership bookkeeping)
     * - error
     *
     * @param {Object} data - Parsed signaling message.
     * @returns {void}
     */
    handleSignalingMessage(data: any): void;
    /**
     * Create and wire a P2PConnection for a remote peer.
     * If one already exists, returns it.
     *
     * @private
     * @param {string} remotePeerId
     * @returns {P2PConnection}
     */
    private createP2PConnection;
    /**
     * Post a signaling payload to the REST API.
     *
     * @private
     * @param {Object} message - Signaling payload (must include `type`).
     * @returns {Promise<Object>}
     */
    private _sendSignal;
    /**
     * Initiate a P2P connection to a remote peer.
     *
     * @param {string} remotePeerId
     * @returns {Promise<Object>} SDP offer.
     */
    initiateP2P(remotePeerId: string): Promise<any>;
    /**
     * Send an application-level message over a specific P2P data channel.
     *
     * @param {string|Object} remotePeerIdOrMessage
     * @param {string|Object} [message]
     * @returns {boolean}
     */
    sendMessage(remotePeerIdOrMessage: string | any, message?: string | any): boolean;
    /**
     * Disconnect a specific peer and remove it from the map.
     *
     * @param {string} remotePeerId
     * @returns {void}
     */
    disconnectPeer(remotePeerId: string): void;
    /**
     * Get the list of peers in the current room.
     *
     * @returns {Array<string>}
     */
    getRoomPeers(): Array<string>;
    /**
     * Whether the client is currently connected.
     *
     * @returns {boolean}
     */
    isConnected(): boolean;
    /**
     * Register a handler for general errors.
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
     * Register a handler for incoming peer messages over the P2P data channel.
     *
     * @param {function(string, string):void} handler
     * @returns {void}
     */
    onPeerMessage(handler: (arg0: string, arg1: string) => void): void;
    /**
     * Emit a general error to all registered error handlers.
     *
     * @private
     * @param {Error} error
     * @returns {void}
     */
    private emitError;
    /**
     * Emit a peer-specific error.
     *
     * @private
     * @param {string} peerId
     * @param {Error} error
     * @returns {void}
     */
    private emitPeerError;
}
import { RestClient } from "./utils/rest-client.js";
import { P2PConnection } from "./p2p-connection.js";
