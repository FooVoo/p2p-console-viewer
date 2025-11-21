export class WebSocketConnector {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.messageHandlers = [];
        this.onOpenHandlers = [];
        this.onCloseHandlers = [];
        this.onErrorHandlers = [];
        this.reconnectInterval = 3000;
        this.shouldReconnect = true;
    }

    /**
     * Connect to the WebSocket server
     */
    connect() {
        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = (event) => {
                console.log('WebSocket connected:', this.url);
                this.onOpenHandlers.forEach(handler => handler(event));
            };

            this.ws.onmessage = (event) => {
                console.log('WebSocket message received:', event.data);
                this.messageHandlers.forEach(handler => handler(event.data));
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.onErrorHandlers.forEach(handler => handler(error));
            };

            this.ws.onclose = (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                this.onCloseHandlers.forEach(handler => handler(event));

                // Auto-reconnect if enabled
                if (this.shouldReconnect) {
                    console.log(`Reconnecting in ${this.reconnectInterval}ms...`);
                    setTimeout(() => this.connect(), this.reconnectInterval);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    }

    /**
     * Send a message through the WebSocket
     * @param {string|object} message - Message to send (will be stringified if object)
     */
    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const data = typeof message === 'string' ? message : JSON.stringify(message);
            this.ws.send(data);
            console.log('WebSocket message sent:', data);
            return true;
        } else {
            console.warn('WebSocket is not open. Current state:', this.ws?.readyState);
            return false;
        }
    }

    /**
     * Register a message handler
     * @param {function} handler - Callback function to handle incoming messages
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * Register an open handler
     * @param {function} handler - Callback function when connection opens
     */
    onOpen(handler) {
        this.onOpenHandlers.push(handler);
    }

    /**
     * Register a close handler
     * @param {function} handler - Callback function when connection closes
     */
    onClose(handler) {
        this.onCloseHandlers.push(handler);
    }

    /**
     * Register an error handler
     * @param {function} handler - Callback function when error occurs
     */
    onError(handler) {
        this.onErrorHandlers.push(handler);
    }

    /**
     * Close the WebSocket connection
     * @param {boolean} preventReconnect - If true, prevents auto-reconnection
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
     * Check if WebSocket is connected
     */
    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}
