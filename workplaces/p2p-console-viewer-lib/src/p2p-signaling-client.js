import { P2PConnection } from "./p2p-connection.js";
import { WebSocketConnector } from "./websocket-connector.js";

/**
 * P2P signaling client that bridges a WebSocket-based signaling server and a local P2P connection.
 *
 * Responsibilities:
 * - Maintain WebSocket connection to signaling server via WebSocketConnector.
 * - Create and manage a P2PConnection for WebRTC data channel communication.
 * - Forward offers, answers, and ICE candidates between the P2P layer and the signaling server.
 *
 * @class
 */
export class P2PSignalingClient {
  /**
   * Create a new P2PSignalingClient.
   *
   * @param {string} signalingServerUrl - URL of the signaling WebSocket server.
   */
  constructor(signalingServerUrl) {
    /**
     * WebSocket connector instance used for signaling.
     * @type {WebSocketConnector}
     */
    this.ws = new WebSocketConnector(signalingServerUrl);

    /**
     * Local P2P connection handling WebRTC logic and data channel.
     * @type {P2PConnection}
     */
    this.p2p = new P2PConnection();

    /**
     * Identifier of the remote peer we are connecting to.
     * @type {string|null}
     */
    this.remotePeerId = null;

    /**
     * Identifier assigned by the signaling server for this client.
     * @type {string|null}
     */
    this.currentServerID = null;

    // Set up signaling and P2P once the WebSocket is ready.
    this.whenConnected(() => {
      this.setupSignaling();
      this.setupP2P();
    });
  }

  /**
   * Wire up WebSocket message handling and open event logging.
   *
   * - Parses incoming signaling messages and delegates to handleSignalingMessage.
   * - Logs when the signaling server connection is established.
   *
   * @private
   */
  setupSignaling() {
    // Handle signaling messages from server
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
   * Wire up P2P event handlers to forward signaling messages via the WebSocket.
   *
   * - Forwards local ICE candidates, offers, and answers to the signaling server.
   * - Registers handlers for incoming P2P messages and connection state.
   *
   * @private
   */
  setupP2P() {
    // Send ICE candidates through signaling server
    this.p2p.onIceCandidate((candidate) => {
      this.ws.send({
        type: "ice-candidate",
        to: this.remotePeerId,
        candidate: candidate,
      });
    });

    // Send offer through signaling server
    this.p2p.onOffer((offer) => {
      this.ws.send({
        type: "offer",
        to: this.remotePeerId,
        offer: offer,
      });
    });

    // Send answer through signaling server
    this.p2p.onAnswer((answer) => {
      this.ws.send({
        type: "answer",
        to: this.remotePeerId,
        answer: answer,
      });
    });

    // Handle P2P messages
    this.p2p.onMessage((message) => {
      console.log("P2P message received:", message);
      // Handle application-level messages
    });

    // Handle P2P connection established
    this.p2p.onConnected(() => {
      console.log("P2P connection established!");
      // Now we can communicate directly without the signaling server
    });
  }

  /**
   * Process signaling messages received from the signaling server.
   *
   * Recognized message types:
   * - 'offer': set remote peer id and pass offer to the P2P connection.
   * - 'answer': pass answer to the P2P connection.
   * - 'ice-candidate': pass ICE candidate to the P2P connection.
   * - 'id': store current server-assigned id.
   *
   * @param {Object} data - Parsed signaling message object.
   * @param {string} data.type - Message type.
   * @param {string} [data.from] - Sender peer id (for offers).
   * @param {Object} [data.offer] - SDP offer (when type === 'offer').
   * @param {Object} [data.answer] - SDP answer (when type === 'answer').
   * @param {Object} [data.candidate] - ICE candidate (when type === 'ice-candidate').
   * @param {string} [data.id] - Assigned id (when type === 'id').
   * @returns {void}
   */
  handleSignalingMessage(data) {
    switch (data.type) {
      case "offer":
        this.remotePeerId = data.from;
        this.p2p.receiveOffer(data.offer);
        break;

      case "answer":
        this.p2p.receiveAnswer(data.answer);
        break;

      case "ice-candidate":
        this.p2p.addIceCandidate(data.candidate);
        break;
      case "id":
        this.currentServerID = data.id;
        break;

      default:
        console.log("Unknown signaling message:", data);
    }
  }

  /**
   * Connect to the signaling server via WebSocket.
   *
   * @returns {void}
   */
  connect() {
    this.ws.connect();
  }

  /**
   * Initiate a P2P connection by setting the target remote peer id and creating an offer.
   *
   * The returned promise resolves with the created SDP offer.
   *
   * @param {string} remotePeerId - The id of the peer to connect to.
   * @returns {Promise<Object>} Promise resolving to the generated SDP offer.
   */
  initiateP2P(remotePeerId) {
    this.remotePeerId = remotePeerId;
    return this.p2p.initiate();
  }

  /**
   * Send an application-level message over the established P2P data channel.
   *
   * Delegates to P2PConnection.send.
   *
   * @param {string|Object} message - Message to send. Objects will be serialized by P2PConnection.
   * @returns {boolean} True if the message was sent, false otherwise.
   */
  sendMessage(message) {
    return this.p2p.send(message);
  }

  /**
   * Cleanly close both P2P and WebSocket connections.
   *
   * @returns {void}
   */
  disconnect() {
    this.p2p.close();
    this.ws.disconnect();
  }

  /**
   * Register a callback to be invoked when the WebSocket is ready/connected.
   *
   * @param {function():void} callback - Function to call when signaling connection is ready.
   * @returns {void}
   */
  whenConnected(callback) {
    this.ws.whenReady(callback);
  }
}
