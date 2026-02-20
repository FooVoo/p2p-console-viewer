import { P2PSignalingClient } from "./p2p-signaling-client.js";
import { ConsoleInterceptor } from "./console-patch.js";
import { P2pMessageHelper } from "./p2p-message-helper.js";

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
  constructor(signalingServerUrl, options = {}) {
    /**
     * Underlying signaling client that manages P2P connections.
     * @type {P2PSignalingClient}
     * @private
     */
    this._signalingClient = new P2PSignalingClient(signalingServerUrl, options);

    /**
     * Console interceptor used to monkey-patch and restore global console.
     * @type {ConsoleInterceptor}
     * @private
     */
    this._interceptor = new ConsoleInterceptor();

    /**
     * Message helper used to build structured message objects from console calls.
     * @type {P2pMessageHelper}
     * @private
     */
    this._helper = new P2pMessageHelper({ namespace: options.namespace || null });

    /**
     * Handlers called when a console message is received from a remote peer.
     * @type {Array<function(string, Object):void>}
     * @private
     */
    this._consoleMessageHandlers = [];

    /**
     * Whether console forwarding is currently active.
     * @type {boolean}
     * @private
     */
    this._active = false;

    // Route incoming P2P messages to registered console message handlers.
    this._signalingClient.onPeerMessage((peerId, rawMessage) => {
      const msg = P2pMessageHelper.parse(rawMessage);
      if (msg && P2pMessageHelper.isConsoleMessage(msg)) {
        this._consoleMessageHandlers.forEach((h) => {
          try {
            h(peerId, msg);
          } catch {
            // A misbehaving handler must not interrupt others.
          }
        });
      }
    });
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Open the connection to the signaling server.
   *
   * @returns {void}
   */
  connect() {
    this._signalingClient.connect();
  }

  /**
   * Start intercepting the global console and forwarding every call to all
   * peers that are currently in the same room.
   *
   * If already active this is a no-op.
   *
   * @returns {void}
   */
  start() {
    if (this._active) { return; }
    this._active = true;

    this._interceptor.patch((method, ...args) => {
      const msg = this._helper.buildMessage(method, args);
      const serialized = P2pMessageHelper.serialize(msg);
      for (const peerId of this._signalingClient.getRoomPeers()) {
        this._signalingClient.sendMessage(peerId, serialized);
      }
    });
  }

  /**
   * Stop intercepting the console. Restores original console methods.
   *
   * If not currently active this is a no-op.
   *
   * @returns {void}
   */
  stop() {
    if (!this._active) { return; }
    this._interceptor.unpatch();
    this._active = false;
  }

  /**
   * Stop console forwarding and close all P2P connections and the signaling
   * WebSocket.
   *
   * @returns {void}
   */
  disconnect() {
    this.stop();
    this._signalingClient.disconnect();
  }

  // ─── State ────────────────────────────────────────────────────────────────

  /**
   * Whether the console is currently being forwarded to remote peers.
   *
   * @type {boolean}
   */
  get isActive() {
    return this._active;
  }

  /**
   * The room this client is currently in (or null).
   *
   * @type {string|null}
   */
  get currentRoom() {
    return this._signalingClient.currentRoom;
  }

  /**
   * The server-assigned ID for this client (or null until assigned).
   *
   * @type {string|null}
   */
  get currentServerID() {
    return this._signalingClient.currentServerID;
  }

  // ─── Event registration ───────────────────────────────────────────────────

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
  onConsoleMessage(handler) {
    this._consoleMessageHandlers.push(handler);
  }

  /**
   * Register a handler for general signaling errors.
   *
   * @param {function(Error):void} handler
   * @returns {void}
   */
  onError(handler) {
    this._signalingClient.onError(handler);
  }

  /**
   * Register a handler for peer-specific errors.
   *
   * @param {function(string, Error):void} handler
   * @returns {void}
   */
  onPeerError(handler) {
    this._signalingClient.onPeerError(handler);
  }

  // ─── Room management ──────────────────────────────────────────────────────

  /**
   * Join a room on the signaling server.
   *
   * @param {string} roomName
   * @returns {boolean} True if the request was sent.
   */
  joinRoom(roomName) {
    return this._signalingClient.joinRoom(roomName);
  }

  /**
   * Leave the current room.
   *
   * @returns {boolean} True if the request was sent.
   */
  leaveRoom() {
    return this._signalingClient.leaveRoom();
  }

  /**
   * Get the IDs of peers currently in the room.
   *
   * @returns {Array<string>}
   */
  getRoomPeers() {
    return this._signalingClient.getRoomPeers();
  }

  // ─── Connection state ─────────────────────────────────────────────────────

  /**
   * Whether the signaling WebSocket is currently open.
   *
   * @returns {boolean}
   */
  isConnected() {
    return this._signalingClient.isConnected();
  }

  /**
   * Get the current WebSocket connection state string.
   *
   * @returns {string} One of: 'connecting', 'open', 'closing', 'closed', 'disconnected'
   */
  getConnectionState() {
    return this._signalingClient.getConnectionState();
  }
}
