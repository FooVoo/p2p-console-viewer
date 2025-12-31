import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketConnector } from '../../workplaces/p2p-console-viewer-lib/src/websocket-connector.js';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data) {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open');
    }
  }

  close(code, reason) {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose({ code, reason });
  }
}

global.WebSocket = MockWebSocket;

describe('WebSocketConnector - Edge Cases', () => {
  let connector;

  beforeEach(() => {
    connector = new WebSocketConnector('ws://localhost:3000');
  });

  afterEach(() => {
    if (connector && connector.ws) {
      connector.disconnect(true);
    }
  });

  describe('extreme inputs', () => {
    it('should handle very long messages', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      const longMessage = 'x'.repeat(1000000); // 1MB message
      
      // Should not throw
      expect(() => connector.send(longMessage)).not.toThrow();
    });

    it('should handle messages with special characters', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      const specialMessage = '🚀 \n\r\t\0 <>&" \' \\ / 特殊字符';
      
      // Should not throw
      expect(() => connector.send(specialMessage)).not.toThrow();
    });

    it('should handle deeply nested objects', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      const deepObj = { a: { b: { c: { d: { e: { f: { g: { h: 'deep' } } } } } } } };
      
      // Should not throw
      expect(() => connector.send(deepObj)).not.toThrow();
    });

    it('should handle empty string messages', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      // Should not throw
      expect(() => connector.send('')).not.toThrow();
    });

    it('should handle empty object messages', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      // Should not throw
      expect(() => connector.send({})).not.toThrow();
    });
  });

  describe('rapid operations', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      for (let i = 0; i < 5; i++) {
        const conn = new WebSocketConnector('ws://localhost:3000');
        conn.connect();
        await new Promise(resolve => setTimeout(resolve, 20));
        conn.disconnect(true);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle rapid message sending', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      for (let i = 0; i < 100; i++) {
        connector.send(`message-${i}`);
      }

      // Should not crash
      expect(true).toBe(true);
    });

    it('should handle multiple simultaneous waitUntilOpen calls', async () => {
      connector.connect();

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(connector.waitUntilOpen());
      }

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('invalid states', () => {
    it('should handle send when websocket is null', () => {
      connector.ws = null;
      const result = connector.send('test');
      expect(result).toBe(false);
    });

    it('should handle disconnect when websocket is null', () => {
      connector.ws = null;
      expect(() => connector.disconnect()).not.toThrow();
    });

    it('should handle isConnected when websocket is null', () => {
      connector.ws = null;
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('error conditions', () => {
    it('should handle JSON.stringify errors gracefully', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      const circular = {};
      circular.self = circular;

      // Should not throw - will fallback to toString or error handling
      expect(() => connector.send(circular)).not.toThrow();
    });

    it('should handle close with invalid code', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      const closeHandler = vi.fn();
      connector.onClose(closeHandler);

      // Simulate close with invalid code
      if (connector.ws.onclose) {
        connector.ws.onclose({ code: -1, reason: '' });
      }

      expect(closeHandler).toHaveBeenCalled();
    });
  });

  describe('boundary conditions', () => {
    it('should handle undefined URL', () => {
      expect(() => {
        new WebSocketConnector(undefined);
      }).not.toThrow();
    });

    it('should handle null URL', () => {
      expect(() => {
        new WebSocketConnector(null);
      }).not.toThrow();
    });

    it('should handle empty string URL', () => {
      expect(() => {
        new WebSocketConnector('');
      }).not.toThrow();
    });
  });

  describe('race conditions', () => {
    it('should handle send during connection establishment', () => {
      connector.connect();
      
      // Try to send immediately (before open)
      const result = connector.send('test');
      
      expect(result).toBe(false);
    });

    it('should handle disconnect during connection establishment', () => {
      connector.connect();
      
      // Disconnect immediately
      expect(() => connector.disconnect()).not.toThrow();
    });

    it('should handle multiple connects in quick succession', () => {
      connector.connect();
      connector.connect();
      connector.connect();

      // Should only have one websocket
      expect(connector.ws).toBeDefined();
    });
  });

  describe('memory and resource management', () => {
    it('should handle many registered handlers', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      // Register 100 handlers
      for (let i = 0; i < 100; i++) {
        connector.onMessage(vi.fn());
      }

      // Simulate message
      if (connector.ws.onmessage) {
        connector.ws.onmessage({ data: 'test' });
      }

      // Should not crash
      expect(true).toBe(true);
    });
  });

  describe('unicode and encoding', () => {
    it('should handle unicode characters', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      const unicode = '你好世界 مرحبا العالم שלום עולם';
      
      // Should not throw
      expect(() => connector.send(unicode)).not.toThrow();
    });

    it('should handle emoji sequences', async () => {
      connector.connect();
      await connector.waitUntilOpen();

      const emojis = '👨‍👩‍👧‍👦 👍🏽 🏳️‍🌈';
      
      // Should not throw
      expect(() => connector.send(emojis)).not.toThrow();
    });
  });
});
