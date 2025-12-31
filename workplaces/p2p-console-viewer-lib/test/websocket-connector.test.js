import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketConnector } from '../src/websocket-connector.js';

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CLOSED;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen({});
    }, 10);
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' });
  }
}

describe('WebSocketConnector', () => {
  let originalWebSocket;

  beforeEach(() => {
    // Mock global WebSocket
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    // Restore original WebSocket
    global.WebSocket = originalWebSocket;
  });

  describe('constructor', () => {
    it('should create instance with URL', () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      expect(connector.url).toBe('ws://localhost:3000');
      expect(connector.ws).toBeNull();
    });

    it('should initialize empty handler arrays', () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      expect(connector.messageHandlers).toEqual([]);
      expect(connector.onOpenHandlers).toEqual([]);
      expect(connector.oneTimeOpenHandlers).toEqual([]);
      expect(connector.onCloseHandlers).toEqual([]);
      expect(connector.onErrorHandlers).toEqual([]);
    });

    it('should set default reconnect settings', () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      expect(connector.reconnectInterval).toBe(3000);
      expect(connector.shouldReconnect).toBe(true);
    });
  });

  describe('connect', () => {
    it('should create WebSocket connection', () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      expect(connector.ws).not.toBeNull();
      expect(connector.ws.url).toBe('ws://localhost:3000');
    });

    it('should trigger onOpen handlers when connected', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const handler = vi.fn();
      connector.onOpen(handler);
      
      connector.connect();
      
      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should trigger one-time open handlers and clear them', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      connector.oneTimeOpenHandlers.push(handler1, handler2);
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(connector.oneTimeOpenHandlers).toEqual([]);
    });
  });

  describe('send', () => {
    it('should send string message when connected', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sendSpy = vi.spyOn(connector.ws, 'send');
      const result = connector.send('test message');
      
      expect(result).toBe(true);
      expect(sendSpy).toHaveBeenCalledWith('test message');
    });

    it('should JSON stringify object messages', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sendSpy = vi.spyOn(connector.ws, 'send');
      const message = { type: 'test', data: 'hello' };
      connector.send(message);
      
      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(message));
    });

    it('should return false when not connected', () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const result = connector.send('test');
      expect(result).toBe(false);
    });
  });

  describe('message handling', () => {
    it('should call message handlers on received message', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const handler = vi.fn();
      connector.onMessage(handler);
      
      connector.connect();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate receiving a message
      connector.ws.onmessage({ data: 'test message' });
      
      expect(handler).toHaveBeenCalledWith('test message');
    });

    it('should support multiple message handlers', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      connector.onMessage(handler1);
      connector.onMessage(handler2);
      
      connector.connect();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      connector.ws.onmessage({ data: 'test' });
      
      expect(handler1).toHaveBeenCalledWith('test');
      expect(handler2).toHaveBeenCalledWith('test');
    });
  });

  describe('whenReady', () => {
    it('should call callback immediately if already connected', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const callback = vi.fn();
      connector.whenReady(callback);
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should call callback when connection opens', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const callback = vi.fn();
      
      connector.whenReady(callback);
      connector.connect();
      
      expect(callback).not.toHaveBeenCalled();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('waitUntilOpen', () => {
    it('should resolve immediately if already connected', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await expect(connector.waitUntilOpen()).resolves.toBeUndefined();
    });

    it('should resolve when connection opens', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      
      const promise = connector.waitUntilOpen();
      connector.connect();
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject on timeout', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      
      // Don't connect, so timeout occurs
      await expect(connector.waitUntilOpen(100)).rejects.toThrow('waitUntilOpen timeout');
    });
  });

  describe('disconnect', () => {
    it('should close WebSocket connection', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const closeSpy = vi.spyOn(connector.ws, 'close');
      connector.disconnect();
      
      expect(closeSpy).toHaveBeenCalled();
    });

    it('should prevent reconnection when specified', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      connector.disconnect(true);
      
      expect(connector.shouldReconnect).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      expect(() => connector.disconnect()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      expect(connector.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(connector.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      connector.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      connector.disconnect();
      
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should call error handlers on error', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const handler = vi.fn();
      connector.onError(handler);
      
      connector.connect();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const error = new Error('Test error');
      connector.ws.onerror(error);
      
      expect(handler).toHaveBeenCalledWith(error);
    });
  });

  describe('close handling', () => {
    it('should call close handlers on close', async () => {
      const connector = new WebSocketConnector('ws://localhost:3000');
      const handler = vi.fn();
      connector.onClose(handler);
      
      connector.connect();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      connector.ws.close();
      
      expect(handler).toHaveBeenCalled();
    });
  });
});
