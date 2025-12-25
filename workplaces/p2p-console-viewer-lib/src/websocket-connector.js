class WebSocketConnector {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.messageHandlers = [];
        this.onOpenHandlers = [];
        this.oneTimeOpenHandlers = []; // handlers that run once when socket opens
        this.onCloseHandlers = [];
        this.onErrorHandlers = [];
        this.reconnectInterval = 3000;
        this.shouldReconnect = true;
    }

    connect() {
        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = (event) => {
                console.log('WebSocket connected:', this.url);
                this.onOpenHandlers.forEach(handler => handler(event));
                // run and clear one-time handlers
                this.oneTimeOpenHandlers.forEach(handler => handler(event));
                this.oneTimeOpenHandlers = [];
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

                if (this.shouldReconnect) {
                    console.log(`Reconnecting in ${this.reconnectInterval}ms...`);
                    setTimeout(() => this.connect(), this.reconnectInterval);
                }
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    }

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

    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    onOpen(handler) {
        this.onOpenHandlers.push(handler);
    }

    onClose(handler) {
        this.onCloseHandlers.push(handler);
    }

    onError(handler) {
        this.onErrorHandlers.push(handler);
    }

    /**
     * Run a callback when the WebSocket is open and ready.
     * If already open, the callback runs immediately; otherwise it runs once after next open.
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
                    this.oneTimeOpenHandlers = this.oneTimeOpenHandlers.filter(h => h !== handler);
                    reject(new Error('waitUntilOpen timeout'));
                }, timeoutMs);
            }
        });
    }

    disconnect(preventReconnect = true) {
        if (preventReconnect) {
            this.shouldReconnect = false;
        }
        if (this.ws) {
            this.ws.close();
        }
    }

    isConnected() {
        return !!(this.ws && this.ws.readyState === WebSocket.OPEN);
    }
}

export { WebSocketConnector };
