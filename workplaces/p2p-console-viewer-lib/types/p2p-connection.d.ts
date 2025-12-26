/**
 * Simple WebRTC P2P Connection
 * Handles peer-to-peer connections with data channel for messaging
 */
export class P2PConnection {
    /**
     * Create a new P2PConnection.
     *
     * @param {Object} [config={}] - Optional RTCPeerConnection configuration.
     * @param {Array<Object>} [config.iceServers] - STUN/TURN servers configuration.
     */
    constructor(config?: {
        iceServers?: Array<any>;
    });
    config: {
        iceServers: any[];
    };
    /**
     * @type {RTCPeerConnection|null}
     * @private
     */
    private peerConnection;
    /**
     * @type {RTCDataChannel|null}
     * @private
     */
    private dataChannel;
    /**
     * Whether this side created the offer (true if initiator).
     * @type {boolean}
     */
    isInitiator: boolean;
    /** @type {Array<function(string|Object):void>} */
    onMessageHandlers: Array<(arg0: string | any) => void>;
    /** @type {Array<function():void>} */
    onConnectedHandlers: Array<() => void>;
    /** @type {Array<function():void>} */
    onDisconnectedHandlers: Array<() => void>;
    /** @type {Array<function(RTCIceCandidate):void>} */
    onIceCandidateHandlers: Array<(arg0: RTCIceCandidate) => void>;
    /** @type {Array<function(RTCSessionDescriptionInit):void>} */
    onOfferHandlers: Array<(arg0: RTCSessionDescriptionInit) => void>;
    /** @type {Array<function(RTCSessionDescriptionInit):void>} */
    onAnswerHandlers: Array<(arg0: RTCSessionDescriptionInit) => void>;
    /** @type {Array<function(RTCDataChannel):void>} */
    onDataChannelHandlers: Array<(arg0: RTCDataChannel) => void>;
    /**
     * Initialize as the connection initiator (creates offer).
     *
     * - Creates RTCPeerConnection
     * - Creates a data channel and attaches handlers
     * - Creates and sets local description (offer)
     * - Emits the offer via registered offer handlers
     *
     * @returns {Promise<RTCSessionDescriptionInit>} The created SDP offer.
     */
    initiate(): Promise<RTCSessionDescriptionInit>;
    /**
     * Initialize as the connection receiver (receives offer, creates answer).
     *
     * - Creates RTCPeerConnection
     * - Sets the remote description (offer)
     * - Creates and sets local description (answer)
     * - Emits the answer via registered answer handlers
     *
     * @param {RTCSessionDescriptionInit} offer - Remote SDP offer.
     * @returns {Promise<RTCSessionDescriptionInit>} The created SDP answer.
     */
    receiveOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
    /**
     * Receive answer from the remote peer and set as remote description.
     *
     * @param {RTCSessionDescriptionInit} answer - Remote SDP answer.
     * @returns {Promise<void>}
     * @throws {Error} If the peer connection is not initialized.
     */
    receiveAnswer(answer: RTCSessionDescriptionInit): Promise<void>;
    /**
     * Add ICE candidate received from remote peer.
     *
     * @param {RTCIceCandidateInit} candidate - ICE candidate object.
     * @returns {Promise<void>}
     * @throws {Error} If the peer connection is not initialized.
     */
    addIceCandidate(candidate: RTCIceCandidateInit): Promise<void>;
    /**
     * Create the RTCPeerConnection and wire up core event handlers.
     *
     * - onicecandidate: emits candidate to registered handlers
     * - onconnectionstatechange: emits connected/disconnected events
     * - oniceconnectionstatechange: logs ICE state
     * - ondatachannel: handles incoming data channels (for non-initiator)
     *
     * @private
     */
    private createPeerConnection;
    /**
     * Setup data channel event handlers for messaging.
     *
     * - onopen/onclose: log state changes
     * - onerror: log errors
     * - onmessage: emit incoming messages to registered handlers
     *
     * @param {RTCDataChannel} channel - The data channel to setup.
     * @private
     */
    private setupDataChannel;
    /**
     * Send a message through the data channel.
     *
     * - If `message` is an object, it will be JSON serialized.
     * - Returns a boolean indicating whether the message was sent.
     *
     * @param {string|Object} message - Message to send.
     * @returns {boolean} True if the message was sent, false otherwise.
     */
    send(message: string | any): boolean;
    /**
     * Register a message handler.
     *
     * @param {function(string|Object):void} handler - Called with incoming message data.
     */
    onMessage(handler: (arg0: string | any) => void): void;
    /**
     * Register a connected handler.
     *
     * @param {function():void} handler - Called when the connection state becomes 'connected'.
     */
    onConnected(handler: () => void): void;
    /**
     * Register a disconnected handler.
     *
     * @param {function():void} handler - Called when the connection is disconnected/failed/closed.
     */
    onDisconnected(handler: () => void): void;
    /**
     * Register an ICE candidate handler.
     *
     * @param {function(RTCIceCandidate):void} handler - Called when a local ICE candidate is discovered.
     */
    onIceCandidate(handler: (arg0: RTCIceCandidate) => void): void;
    /**
     * Register an offer handler.
     *
     * @param {function(RTCSessionDescriptionInit):void} handler - Called with the local offer SDP.
     */
    onOffer(handler: (arg0: RTCSessionDescriptionInit) => void): void;
    /**
     * Register an answer handler.
     *
     * @param {function(RTCSessionDescriptionInit):void} handler - Called with the local answer SDP.
     */
    onAnswer(handler: (arg0: RTCSessionDescriptionInit) => void): void;
    /**
     * Register a data channel handler.
     *
     * @param {function(RTCDataChannel):void} handler - Called when a remote data channel is received.
     */
    onDataChannel(handler: (arg0: RTCDataChannel) => void): void;
    /**
     * Close the connection and cleanup resources.
     *
     * - Closes data channel and peer connection if they exist.
     */
    close(): void;
    /**
     * Check if connection is established and data channel is open.
     *
     * @returns {boolean} True when peer connection is connected and data channel is open.
     */
    isConnected(): boolean;
    /**
     * Get connection statistics from the RTCPeerConnection.
     *
     * @returns {Promise<RTCStatsReport|null>} RTC stats report or null if no peer connection.
     */
    getStats(): Promise<RTCStatsReport | null>;
}
