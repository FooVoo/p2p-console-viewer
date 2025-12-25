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
  constructor(config = {}) {
    // Default STUN servers for NAT traversal
    this.config = {
      iceServers: config.iceServers || [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    /**
     * @type {RTCPeerConnection|null}
     * @private
     */
    this.peerConnection = null;

    /**
     * @type {RTCDataChannel|null}
     * @private
     */
    this.dataChannel = null;

    /**
     * Whether this side created the offer (true if initiator).
     * @type {boolean}
     */
    this.isInitiator = false;

    // Event handlers (arrays to allow multiple listeners)
    /** @type {Array<function(string|Object):void>} */
    this.onMessageHandlers = [];
    /** @type {Array<function():void>} */
    this.onConnectedHandlers = [];
    /** @type {Array<function():void>} */
    this.onDisconnectedHandlers = [];
    /** @type {Array<function(RTCIceCandidate):void>} */
    this.onIceCandidateHandlers = [];
    /** @type {Array<function(RTCSessionDescriptionInit):void>} */
    this.onOfferHandlers = [];
    /** @type {Array<function(RTCSessionDescriptionInit):void>} */
    this.onAnswerHandlers = [];
    /** @type {Array<function(RTCDataChannel):void>} */
    this.onDataChannelHandlers = [];
  }

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
  async initiate() {
    this.isInitiator = true;
    this.createPeerConnection();

    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel("dataChannel");
    this.setupDataChannel(this.dataChannel);

    // Create and return offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    console.log("Created offer:", offer);
    this.onOfferHandlers.forEach((handler) => handler(offer));

    return offer;
  }

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
  async receiveOffer(offer) {
    this.isInitiator = false;
    this.createPeerConnection();

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer),
    );

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    console.log("Created answer:", answer);
    this.onAnswerHandlers.forEach((handler) => handler(answer));

    return answer;
  }

  /**
   * Receive answer from the remote peer and set as remote description.
   *
   * @param {RTCSessionDescriptionInit} answer - Remote SDP answer.
   * @returns {Promise<void>}
   * @throws {Error} If the peer connection is not initialized.
   */
  async receiveAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized");
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer),
    );
    console.log("Answer received and set");
  }

  /**
   * Add ICE candidate received from remote peer.
   *
   * @param {RTCIceCandidateInit} candidate - ICE candidate object.
   * @returns {Promise<void>}
   * @throws {Error} If the peer connection is not initialized.
   */
  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized");
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log("ICE candidate added:", candidate);
    } catch (error) {
      console.error("Error adding ICE candidate:", error);
    }
  }

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
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.config);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("New ICE candidate:", event.candidate);
        this.onIceCandidateHandlers.forEach((handler) =>
          handler(event.candidate),
        );
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log("Connection state:", this.peerConnection.connectionState);

      if (this.peerConnection.connectionState === "connected") {
        this.onConnectedHandlers.forEach((handler) => handler());
      } else if (
        this.peerConnection.connectionState === "disconnected" ||
        this.peerConnection.connectionState === "failed" ||
        this.peerConnection.connectionState === "closed"
      ) {
        this.onDisconnectedHandlers.forEach((handler) => handler());
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state:",
        this.peerConnection.iceConnectionState,
      );
    };

    // Handle data channel (for non-initiator)
    if (!this.isInitiator) {
      this.peerConnection.ondatachannel = (event) => {
        console.log("Data channel received");
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
        this.onDataChannelHandlers.forEach((handler) =>
          handler(this.dataChannel),
        );
      };
    }
  }

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
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log("Data channel opened");
    };

    channel.onclose = () => {
      console.log("Data channel closed");
    };

    channel.onerror = (error) => {
      console.error("Data channel error:", error);
    };

    channel.onmessage = (event) => {
      console.log("Data channel message received:", event.data);
      this.onMessageHandlers.forEach((handler) => handler(event.data));
    };
  }

  /**
   * Send a message through the data channel.
   *
   * - If `message` is an object, it will be JSON serialized.
   * - Returns a boolean indicating whether the message was sent.
   *
   * @param {string|Object} message - Message to send.
   * @returns {boolean} True if the message was sent, false otherwise.
   */
  send(message) {
    if (!this.dataChannel) {
      console.warn("Data channel not initialized");
      return false;
    }

    if (this.dataChannel.readyState !== "open") {
      console.warn(
        "Data channel is not open. Current state:",
        this.dataChannel.readyState,
      );
      return false;
    }

    const data =
      typeof message === "string" ? message : JSON.stringify(message);
    this.dataChannel.send(data);
    console.log("Message sent:", data);
    return true;
  }

  /**
   * Register a message handler.
   *
   * @param {function(string|Object):void} handler - Called with incoming message data.
   */
  onMessage(handler) {
    this.onMessageHandlers.push(handler);
  }

  /**
   * Register a connected handler.
   *
   * @param {function():void} handler - Called when the connection state becomes 'connected'.
   */
  onConnected(handler) {
    this.onConnectedHandlers.push(handler);
  }

  /**
   * Register a disconnected handler.
   *
   * @param {function():void} handler - Called when the connection is disconnected/failed/closed.
   */
  onDisconnected(handler) {
    this.onDisconnectedHandlers.push(handler);
  }

  /**
   * Register an ICE candidate handler.
   *
   * @param {function(RTCIceCandidate):void} handler - Called when a local ICE candidate is discovered.
   */
  onIceCandidate(handler) {
    this.onIceCandidateHandlers.push(handler);
  }

  /**
   * Register an offer handler.
   *
   * @param {function(RTCSessionDescriptionInit):void} handler - Called with the local offer SDP.
   */
  onOffer(handler) {
    this.onOfferHandlers.push(handler);
  }

  /**
   * Register an answer handler.
   *
   * @param {function(RTCSessionDescriptionInit):void} handler - Called with the local answer SDP.
   */
  onAnswer(handler) {
    this.onAnswerHandlers.push(handler);
  }

  /**
   * Register a data channel handler.
   *
   * @param {function(RTCDataChannel):void} handler - Called when a remote data channel is received.
   */
  onDataChannel(handler) {
    this.onDataChannelHandlers.push(handler);
  }

  /**
   * Close the connection and cleanup resources.
   *
   * - Closes data channel and peer connection if they exist.
   */
  close() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    console.log("P2P connection closed");
  }

  /**
   * Check if connection is established and data channel is open.
   *
   * @returns {boolean} True when peer connection is connected and data channel is open.
   */
  isConnected() {
    return (
      this.peerConnection &&
      this.peerConnection.connectionState === "connected" &&
      this.dataChannel &&
      this.dataChannel.readyState === "open"
    );
  }

  /**
   * Get connection statistics from the RTCPeerConnection.
   *
   * @returns {Promise<RTCStatsReport|null>} RTC stats report or null if no peer connection.
   */
  async getStats() {
    if (!this.peerConnection) {
      return null;
    }

    const stats = await this.peerConnection.getStats();
    return stats;
  }
}
