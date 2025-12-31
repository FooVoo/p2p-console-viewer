// javascript
import { P2PConnection } from "./p2p-connection.js";
import { WebSocketConnector } from "./websocket-connector.js";

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
  constructor(signalingServerUrl, options = {}) {
    /**
     * WebSocket connector instance used to communicate with the signaling server.
     * @type {WebSocketConnector}
     */
    this.ws = new WebSocketConnector(signalingServerUrl);

    /**
     * Map of remotePeerId -> P2PConnection instances.
     * @type {Map<string, P2PConnection>}
     */
    this.peers = new Map();

    /**
     * The id assigned by the signaling server for this client (if provided).
     * @type {string|null}
     */
    this.currentServerID = null;

    /**
     * The room this client is currently in.
     * @type {string|null}
     */
    this.currentRoom = options.room || null;

    /**
     * List of peer IDs in the current room.
     * @type {Array<string>}
     */
    this.roomPeers = [];

    /**
     * Error event handlers.
     * @type {Array<function(Error):void>}
     */
    this.onErrorHandlers = [];

    /**
     * Peer error handlers - called when a specific peer connection fails.
     * Examples: connection establishment failures, offer/answer processing errors,
     * WebSocket send failures for signaling messages.
     * @type {Array<function(string, Error):void>}
     */
    this.onPeerErrorHandlers = [];

    // Register WebSocket error handler
    this.ws.onError((error) => {
      this.emitError(new Error(`WebSocket error: ${error.message || 'Unknown error'}`));
    });

    // Delay wiring signaling handlers until the WS reports ready.
    this.whenConnected(() => {
      this.setupSignaling();
      // Auto-join room if specified
      if (this.currentRoom) {
        this.joinRoom(this.currentRoom);
      }
    });
  }

  /**
   * Wire WebSocket events to parse and forward incoming signaling messages.
   * Sets up:
   * - onMessage: parse JSON and delegate to handleSignalingMessage
   * - onOpen: log connection established
   *
   * @private
   * @returns {void}
   */
  setupSignaling() {
    this.ws.onMessage((message) => {
      try {
        const data = JSON.parse(message);
        this.handleSignalingMessage(data);
      } catch (e) {
        console.error("Failed to parse signaling message:", e);
      }
    });

    this.ws.onOpen(() => {
      console.log("Signaling server connected");
    });
  }

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
  createP2PConnection(remotePeerId) {
    if (this.peers.has(remotePeerId)) {
      return this.peers.get(remotePeerId);
    }

    const p2p = new P2PConnection();

    // Forward local ICE candidates for this peer
    p2p.onIceCandidate((candidate) => {
      const sent = this.ws.send({
        type: "ice-candidate",
        to: remotePeerId,
        candidate,
      });
      if (!sent) {
        console.warn(`Failed to send ICE candidate to ${remotePeerId} - WebSocket not ready`);
      }
    });

    // Forward local offers for this peer
    p2p.onOffer((offer) => {
      const sent = this.ws.send({
        type: "offer",
        to: remotePeerId,
        offer,
      });
      if (!sent) {
        this.emitPeerError(remotePeerId, new Error('Failed to send offer - WebSocket not ready'));
      }
    });

    // Forward local answers for this peer
    p2p.onAnswer((answer) => {
      const sent = this.ws.send({
        type: "answer",
        to: remotePeerId,
        answer,
      });
      if (!sent) {
        this.emitPeerError(remotePeerId, new Error('Failed to send answer - WebSocket not ready'));
      }
    });

    // Application-level messages from this peer
    p2p.onMessage((message) => {
      console.log(`P2P message received from ${remotePeerId}:`, message);
      // Application logic can be added here or p2p can expose events upward.
    });

    // Connection established for this peer
    p2p.onConnected(() => {
      console.log(`P2P connection established with ${remotePeerId}`);
    });

    // Handle disconnections
    p2p.onDisconnected(() => {
      console.log(`P2P connection disconnected from ${remotePeerId}`);
    });

    // Store and return
    this.peers.set(remotePeerId, p2p);
    return p2p;
  }

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
  handleSignalingMessage(data) {
    switch (data.type) {
      case "offer": {
        const from = data.from;
        if (!from) {
          console.warn("Offer received without `from` field:", data);
          return;
        }
        const p2p = this.createP2PConnection(from);
        // Handle offer asynchronously and catch errors
        p2p.receiveOffer(data.offer).catch((error) => {
          console.error(`Failed to receive offer from ${from}:`, error);
          this.emitPeerError(from, error);
        });
        break;
      }

      case "answer": {
        const from = data.from;
        if (!from) {
          console.warn("Answer received without `from` field:", data);
          return;
        }
        const p2p = this.peers.get(from);
        if (p2p) {
          // Handle answer asynchronously and catch errors
          p2p.receiveAnswer(data.answer).catch((error) => {
            console.error(`Failed to receive answer from ${from}:`, error);
            this.emitPeerError(from, error);
          });
        } else {
          console.warn("Received answer for unknown peer:", from);
        }
        break;
      }

      case "ice-candidate": {
        const from = data.from;
        if (!from) {
          console.warn("ICE candidate received without `from` field:", data);
          return;
        }
        const p2p = this.peers.get(from);
        if (p2p) {
          // Handle ICE candidate asynchronously and catch errors
          p2p.addIceCandidate(data.candidate).catch((error) => {
            console.error(`Failed to add ICE candidate from ${from}:`, error);
            // ICE candidate errors are less critical, don't emit peer error
          });
        } else {
          console.warn("Received ICE candidate for unknown peer:", from);
        }
        break;
      }

      case "id":
        // Server assigned id for this client
        this.currentServerID = data.id;
        console.log("Assigned server ID:", this.currentServerID);
        break;

      case "room-joined":
        // Confirmation that we joined a room
        this.currentRoom = data.room;
        console.log("Joined room:", this.currentRoom);
        break;

      case "room-left":
        // Confirmation that we left a room
        console.log("Left room:", data.room);
        this.currentRoom = null;
        this.roomPeers = [];
        break;

      case "room-peers":
        // List of peers currently in the room
        this.roomPeers = data.peers || [];
        console.log("Peers in room:", this.roomPeers);
        break;

      case "peer-joined":
        // A new peer joined the room
        if (data.peerId && !this.roomPeers.includes(data.peerId)) {
          this.roomPeers.push(data.peerId);
          console.log("Peer joined room:", data.peerId);
        }
        break;

      case "peer-left":
        // A peer left the room
        if (data.peerId) {
          this.roomPeers = this.roomPeers.filter((id) => id !== data.peerId);
          console.log("Peer left room:", data.peerId);
          // Clean up P2P connection for this peer
          this.disconnectPeer(data.peerId);
        }
        break;

      case "error":
        // Server error message
        const errorMsg = data.message || "Unknown server error";
        console.error("Server error:", errorMsg);
        this.emitError(new Error(errorMsg));
        break;

      default:
        console.log("Unknown signaling message:", data);
    }
  }

  /**
   * Open the signaling WebSocket connection.
   *
   * @returns {void}
   */
  connect() {
    this.ws.connect();
  }

  /**
   * Join a room on the signaling server.
   *
   * @param {string} roomName - Name of the room to join.
   * @returns {boolean} True if the join request was sent, false otherwise.
   */
  joinRoom(roomName) {
    if (!roomName || typeof roomName !== 'string' || roomName.trim() === '') {
      console.warn("Valid room name is required to join a room");
      return false;
    }
    const sent = this.ws.send({
      type: "join-room",
      room: roomName,
    });
    if (sent) {
      console.log("Requesting to join room:", roomName);
    } else {
      console.warn("Failed to send join room request - WebSocket not ready");
    }
    return sent;
  }

  /**
   * Leave the current room on the signaling server.
   *
   * @returns {boolean} True if the leave request was sent, false otherwise.
   */
  leaveRoom() {
    if (!this.currentRoom) {
      console.warn("Not currently in a room");
      return false;
    }
    const sent = this.ws.send({
      type: "leave-room",
    });
    if (sent) {
      console.log("Requesting to leave room:", this.currentRoom);
    } else {
      console.warn("Failed to send leave room request - WebSocket not ready");
    }
    return sent;
  }

  /**
   * Get the list of peers in the current room.
   *
   * @returns {Array<string>} Array of peer IDs in the current room.
   */
  getRoomPeers() {
    return [...this.roomPeers];
  }

  /**
   * Initiate a P2P connection to a remote peer.
   *
   * Creates (or reuses) a P2PConnection and calls its `initiate()` method which
   * typically creates a local SDP offer and returns it.
   *
   * @param {string} remotePeerId - Identifier of the peer to initiate a connection with.
   * @returns {Promise<Object>} Resolves with the created SDP offer object, or rejects on error.
   */
  async initiateP2P(remotePeerId) {
    if (!remotePeerId || typeof remotePeerId !== 'string' || remotePeerId.trim() === '') {
      const error = new Error('Valid remotePeerId is required');
      this.emitError(error);
      throw error;
    }

    try {
      const p2p = this.createP2PConnection(remotePeerId);
      const offer = await p2p.initiate();
      return offer;
    } catch (error) {
      console.error(`Failed to initiate P2P connection with ${remotePeerId}:`, error);
      this.emitPeerError(remotePeerId, error);
      throw error;
    }
  }

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
  sendMessage(remotePeerIdOrMessage, message) {
    let remotePeerId = null;
    let payload = message;

    if (typeof message === "undefined") {
      // Only one arg provided -> treat as payload and send to first connected peer
      payload = remotePeerIdOrMessage;
      const first = this.peers.values().next();
      if (first.done) return false;
      const firstP2P = first.value;
      return firstP2P.send(payload);
    } else {
      remotePeerId = remotePeerIdOrMessage;
    }

    const p2p = this.peers.get(remotePeerId);
    if (!p2p) {
      console.warn("Attempt to send message to unknown peer:", remotePeerId);
      return false;
    }
    return p2p.send(payload);
  }

  /**
   * Disconnect a specific peer connection and remove it from the peers map.
   *
   * @param {string} remotePeerId - Identifier of the peer to disconnect.
   * @returns {void}
   */
  disconnectPeer(remotePeerId) {
    const p2p = this.peers.get(remotePeerId);
    if (p2p) {
      try {
        p2p.close();
      } catch (e) {
        console.warn("Error closing peer connection", remotePeerId, e);
      }
      this.peers.delete(remotePeerId);
    }
  }

  /**
   * Close all P2P connections and the signaling WebSocket.
   *
   * Ensures per-peer `close()` is called and clears internal state.
   *
   * @returns {void}
   */
  disconnect() {
    for (const [id, p2p] of this.peers.entries()) {
      try {
        p2p.close();
      } catch (e) {
        console.warn("Error closing peer connection", id, e);
      }
    }
    this.peers.clear();
    this.ws.disconnect();
  }

  /**
   * Force an immediate reconnection to the signaling server.
   * Closes all P2P connections and reconnects the WebSocket.
   *
   * @returns {void}
   */
  forceReconnect() {
    console.log("Force reconnecting signaling client...");
    // Close all P2P connections
    for (const [id, p2p] of this.peers.entries()) {
      try {
        p2p.close();
      } catch (e) {
        console.warn("Error closing peer connection during reconnect", id, e);
      }
    }
    this.peers.clear();
    this.currentServerID = null;
    this.roomPeers = [];
    
    // Force WebSocket reconnection
    this.ws.forceReconnect();
    
    // Re-join room if we were in one
    if (this.currentRoom) {
      this.whenConnected(() => {
        this.joinRoom(this.currentRoom);
      });
    }
  }

  /**
   * Get the current WebSocket connection state.
   *
   * @returns {string} One of: 'connecting', 'open', 'closing', 'closed', 'disconnected'
   */
  getConnectionState() {
    return this.ws.getConnectionState();
  }

  /**
   * Set the WebSocket reconnection interval.
   *
   * @param {number} intervalMs - Milliseconds to wait before reconnecting after close.
   * @returns {void}
   */
  setReconnectInterval(intervalMs) {
    this.ws.setReconnectInterval(intervalMs);
  }

  /**
   * Enable automatic reconnection for the WebSocket.
   *
   * @returns {void}
   */
  enableAutoReconnect() {
    this.ws.enableAutoReconnect();
  }

  /**
   * Disable automatic reconnection for the WebSocket.
   *
   * @returns {void}
   */
  disableAutoReconnect() {
    this.ws.disableAutoReconnect();
  }

  /**
   * Check if the WebSocket is currently connected.
   *
   * @returns {boolean} True if connected, false otherwise.
   */
  isConnected() {
    return this.ws.isConnected();
  }

  /**
   * Register a callback to be executed when the signaling WebSocket is ready.
   *
   * Delegates to the underlying WebSocketConnector's `whenReady` method.
   * Wraps the callback to catch and handle errors gracefully.
   *
   * @param {Function} callback - Callback to execute when WS is ready.
   * @returns {void}
   */
  whenConnected(callback) {
    this.ws.whenReady(() => {
      try {
        callback();
      } catch (error) {
        console.error("Error in whenConnected callback:", error);
        this.emitError(error);
      }
    });
  }

  /**
   * Register a handler for general errors.
   *
   * @param {function(Error):void} handler - Called when an error occurs.
   * @returns {void}
   */
  onError(handler) {
    this.onErrorHandlers.push(handler);
  }

  /**
   * Register a handler for peer-specific errors.
   *
   * @param {function(string, Error):void} handler - Called when a peer connection error occurs.
   * @returns {void}
   */
  onPeerError(handler) {
    this.onPeerErrorHandlers.push(handler);
  }

  /**
   * Emit a general error to all registered error handlers.
   *
   * @private
   * @param {Error} error - The error to emit.
   * @returns {void}
   */
  emitError(error) {
    this.onErrorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (e) {
        console.error("Error in error handler:", e);
      }
    });
  }

  /**
   * Emit a peer-specific error to all registered peer error handlers.
   *
   * @private
   * @param {string} peerId - The peer ID associated with the error.
   * @param {Error} error - The error to emit.
   * @returns {void}
   */
  emitPeerError(peerId, error) {
    this.onPeerErrorHandlers.forEach((handler) => {
      try {
        handler(peerId, error);
      } catch (e) {
        console.error("Error in peer error handler:", e);
      }
    });
  }
}
