/**
 * WebSocketConnector
 *
 * Lightweight wrapper around the browser WebSocket API providing:
 * - auto-reconnect support
 * - handler registration for open/message/close/error events
 * - utilities to wait until the socket is ready (one-time handlers / promise)
 *
 * Example usage:
 * const connector = new WebSocketConnector('wss://example.com');
 * connector.onMessage(msg => console.log(msg));
 * connector.connect();
 */
class WebSocketConnector {
  /**
   * Create a new WebSocketConnector.
   *
   * @param {string} url - WebSocket server URL.
   */
  constructor(url) {
    /**
     * The WebSocket server URL.
     * @type {string}
     */
    this.url = url;

    /**
     * Underlying WebSocket instance (or null if not connected).
     * @type {WebSocket|null}
     */
    this.ws = null;

    /**
     * Registered message handlers. Each receives the raw message data (string).
     * @type {Array<function(string):void>}
     */
    this.messageHandlers = [];

    /**
     * Handlers invoked on every open event.
     * @type {Array<function(Event):void>}
     */
    this.onOpenHandlers = [];

    /**
     * Handlers that run once when the socket next opens (then cleared).
     * Useful for waiting for readiness.
     * @type {Array<function(Event):void>}
     */
    this.oneTimeOpenHandlers = []; // handlers that run once when socket opens

    /**
     * Handlers invoked on close events.
     * @type {Array<function(CloseEvent):void>}
     */
    this.onCloseHandlers = [];

    /**
     * Handlers invoked on error events.
     * @type {Array<function(Event):void>}
     */
    this.onErrorHandlers = [];

    /**
     * Milliseconds to wait before attempting to reconnect after a close.
     * @type {number}
     */
    this.reconnectInterval = 3000;

    /**
     * Whether the connector should attempt automatic reconnection after close.
     * @type {boolean}
     */
    this.shouldReconnect = true;
  }

  /**
   * Open the WebSocket connection and wire up event handlers.
   *
   * - Logs lifecycle events to the console.
   * - For incoming messages, handlers receive the event.data (string).
   * - On close, will auto-reconnect after `reconnectInterval` if `shouldReconnect` is true.
   *
   * @returns {void}
   */
  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = (event) => {
        console.log("WebSocket connected:", this.url);
        this.onOpenHandlers.forEach((handler) => handler(event));
        // run and clear one-time handlers
        this.oneTimeOpenHandlers.forEach((handler) => handler(event));
        this.oneTimeOpenHandlers = [];
      };

      this.ws.onmessage = (event) => {
        console.log("WebSocket message received:", event.data);
        this.messageHandlers.forEach((handler) => handler(event.data));
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.onErrorHandlers.forEach((handler) => handler(error));
      };

      this.ws.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        this.onCloseHandlers.forEach((handler) => handler(event));

        if (this.shouldReconnect) {
          console.log(`Reconnecting in ${this.reconnectInterval}ms...`);
          setTimeout(() => this.connect(), this.reconnectInterval);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
    }
  }

  /**
   * Send a message over the WebSocket.
   *
   * - If the message is not a string, it will be JSON serialized.
   * - Returns true when the message was queued for send; false otherwise.
   *
   * @param {string|Object} message - Message payload to send.
   * @returns {boolean} True if sent, false if socket not open.
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const data =
        typeof message === "string" ? message : JSON.stringify(message);
      this.ws.send(data);
      console.log("WebSocket message sent:", data);
      return true;
    } else {
      console.warn(
        "WebSocket is not open. Current state:",
        this.ws?.readyState,
      );
      return false;
    }
  }

  /**
   * Register a handler for incoming messages.
   *
   * @param {function(string):void} handler - Called with raw message data.
   */
  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  /**
   * Register a handler invoked on every open event.
   *
   * @param {function(Event):void} handler
   */
  onOpen(handler) {
    this.onOpenHandlers.push(handler);
  }

  /**
   * Register a handler invoked when the socket closes.
   *
   * @param {function(CloseEvent):void} handler
   */
  onClose(handler) {
    this.onCloseHandlers.push(handler);
  }

  /**
   * Register a handler invoked on socket errors.
   *
   * @param {function(Event):void} handler
   */
  onError(handler) {
    this.onErrorHandlers.push(handler);
  }

  /**
   * Run a callback when the WebSocket is open and ready.
   *
   * - If already open, the callback runs immediately.
   * - Otherwise the callback will run once after the next open event.
   *
   * @param {function():void} callback - Called when socket is ready.
   */
  whenReady(callback) {
    if (this.isConnected()) {
      callback();
    } else {
      this.oneTimeOpenHandlers.push(() => callback());
    }
  }

  /**
   * Returns a Promise that resolves when the WebSocket becomes open.
   *
   * - Optionally accepts a timeout in milliseconds to reject if not opened in time.
   *
   * @param {number} [timeoutMs=0] - Timeout in ms (0 for no timeout).
   * @returns {Promise<void>} Resolves when socket opens, rejects on timeout.
   */
  waitUntilOpen(timeoutMs = 0) {
    if (this.isConnected()) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const handler = () => {
        clearTimeout(timer);
        resolve();
      };
      this.oneTimeOpenHandlers.push(handler);
      let timer;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          // remove the handler if timeout occurs
          this.oneTimeOpenHandlers = this.oneTimeOpenHandlers.filter(
            (h) => h !== handler,
          );
          reject(new Error("waitUntilOpen timeout"));
        }, timeoutMs);
      }
    });
  }

  /**
   * Close the WebSocket connection.
   *
   * @param {boolean} [preventReconnect=true] - If true, stops automatic reconnection.
   * @returns {void}
   */
  disconnect(preventReconnect = true) {
    if (preventReconnect) {
      this.shouldReconnect = false;
    }
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Check whether the underlying WebSocket is currently open.
   *
   * @returns {boolean} True when connected and readyState is WebSocket.OPEN.
   */
  isConnected() {
    return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }
}

export { WebSocketConnector };
