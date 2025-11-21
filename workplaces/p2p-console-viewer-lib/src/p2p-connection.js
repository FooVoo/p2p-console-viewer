/**
 * Simple WebRTC P2P Connection
 * Handles peer-to-peer connections with data channel for messaging
 */
class P2PConnection {
  constructor(config = {}) {
    // Default STUN servers for NAT traversal
    this.config = {
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = null;
    this.dataChannel = null;
    this.isInitiator = false;

    // Event handlers
    this.onMessageHandlers = [];
    this.onConnectedHandlers = [];
    this.onDisconnectedHandlers = [];
    this.onIceCandidateHandlers = [];
    this.onOfferHandlers = [];
    this.onAnswerHandlers = [];
    this.onDataChannelHandlers = [];
  }

  /**
   * Initialize as the connection initiator (creates offer)
   */
  async initiate() {
    this.isInitiator = true;
    this.createPeerConnection();

    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel('dataChannel');
    this.setupDataChannel(this.dataChannel);

    // Create and return offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    console.log('Created offer:', offer);
    this.onOfferHandlers.forEach(handler => handler(offer));

    return offer;
  }

  /**
   * Initialize as the connection receiver (receives offer, creates answer)
   */
  async receiveOffer(offer) {
    this.isInitiator = false;
    this.createPeerConnection();

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    console.log('Created answer:', answer);
    this.onAnswerHandlers.forEach(handler => handler(answer));

    return answer;
  }

  /**
   * Receive answer from the remote peer
   */
  async receiveAnswer(answer) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    console.log('Answer received and set');
  }

  /**
   * Add ICE candidate received from remote peer
   */
  async addIceCandidate(candidate) {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('ICE candidate added:', candidate);
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  /**
   * Create the RTCPeerConnection
   */
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.config);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('New ICE candidate:', event.candidate);
        this.onIceCandidateHandlers.forEach(handler => handler(event.candidate));
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);

      if (this.peerConnection.connectionState === 'connected') {
        this.onConnectedHandlers.forEach(handler => handler());
      } else if (this.peerConnection.connectionState === 'disconnected' ||
                 this.peerConnection.connectionState === 'failed' ||
                 this.peerConnection.connectionState === 'closed') {
        this.onDisconnectedHandlers.forEach(handler => handler());
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };

    // Handle data channel (for non-initiator)
    if (!this.isInitiator) {
      this.peerConnection.ondatachannel = (event) => {
        console.log('Data channel received');
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
        this.onDataChannelHandlers.forEach(handler => handler(this.dataChannel));
      };
    }
  }

  /**
   * Setup data channel event handlers
   */
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('Data channel opened');
    };

    channel.onclose = () => {
      console.log('Data channel closed');
    };

    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };

    channel.onmessage = (event) => {
      console.log('Data channel message received:', event.data);
      this.onMessageHandlers.forEach(handler => handler(event.data));
    };
  }

  /**
   * Send a message through the data channel
   * @param {string|object} message - Message to send
   */
  send(message) {
    if (!this.dataChannel) {
      console.warn('Data channel not initialized');
      return false;
    }

    if (this.dataChannel.readyState !== 'open') {
      console.warn('Data channel is not open. Current state:', this.dataChannel.readyState);
      return false;
    }

    const data = typeof message === 'string' ? message : JSON.stringify(message);
    this.dataChannel.send(data);
    console.log('Message sent:', data);
    return true;
  }

  /**
   * Register a message handler
   */
  onMessage(handler) {
    this.onMessageHandlers.push(handler);
  }

  /**
   * Register a connected handler
   */
  onConnected(handler) {
    this.onConnectedHandlers.push(handler);
  }

  /**
   * Register a disconnected handler
   */
  onDisconnected(handler) {
    this.onDisconnectedHandlers.push(handler);
  }

  /**
   * Register an ICE candidate handler
   */
  onIceCandidate(handler) {
    this.onIceCandidateHandlers.push(handler);
  }

  /**
   * Register an offer handler
   */
  onOffer(handler) {
    this.onOfferHandlers.push(handler);
  }

  /**
   * Register an answer handler
   */
  onAnswer(handler) {
    this.onAnswerHandlers.push(handler);
  }

  /**
   * Register a data channel handler
   */
  onDataChannel(handler) {
    this.onDataChannelHandlers.push(handler);
  }

  /**
   * Close the connection
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

    console.log('P2P connection closed');
  }

  /**
   * Check if connection is established
   */
  isConnected() {
    return this.peerConnection &&
           this.peerConnection.connectionState === 'connected' &&
           this.dataChannel &&
           this.dataChannel.readyState === 'open';
  }

  /**
   * Get connection statistics
   */
  async getStats() {
    if (!this.peerConnection) {
      return null;
    }

    const stats = await this.peerConnection.getStats();
    return stats;
  }
}

export default P2PConnection;
export { P2PConnection };

