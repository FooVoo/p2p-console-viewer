import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketConnector } from '../../workplaces/p2p-console-viewer-lib/src/websocket-connector.js';

describe('WebSocketConnector - Connection Controls', () => {
  let connector;
  let mockWs;

  beforeEach(() => {
    // Mock WebSocket
    mockWs = {
      readyState: 1, // WebSocket.OPEN
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    global.WebSocket = vi.fn(() => mockWs);
    global.WebSocket.CONNECTING = 0;
    global.WebSocket.OPEN = 1;
    global.WebSocket.CLOSING = 2;
    global.WebSocket.CLOSED = 3;

    connector = new WebSocketConnector('ws://localhost:3000');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('forceReconnect()', () => {
    it('should close existing connection and reconnect immediately', () => {
      connector.connect();
      const firstWs = connector.ws;
      
      connector.forceReconnect();
      
      expect(firstWs.close).toHaveBeenCalled();
      expect(global.WebSocket).toHaveBeenCalledTimes(2); // Initial connect + force reconnect
    });

    it('should work when no connection exists', () => {
      expect(() => connector.forceReconnect()).not.toThrow();
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
    });

    it('should preserve shouldReconnect flag', () => {
      connector.shouldReconnect = true;
      connector.connect();
      
      connector.forceReconnect();
      
      expect(connector.shouldReconnect).toBe(true);
    });

    it('should not trigger auto-reconnect during forced reconnect', () => {
      connector.connect();
      connector.shouldReconnect = true;
      
      // Mock onclose to verify auto-reconnect doesn't fire
      const closeHandler = vi.fn();
      connector.onClose(closeHandler);
      
      connector.forceReconnect();
      
      // Should connect twice (initial + forced), not trigger auto-reconnect
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
    });
  });

  describe('getConnectionState()', () => {
    it('should return "disconnected" when no WebSocket exists', () => {
      expect(connector.getConnectionState()).toBe('disconnected');
    });

    it('should return "connecting" for CONNECTING state', () => {
      mockWs.readyState = WebSocket.CONNECTING;
      connector.connect();
      
      expect(connector.getConnectionState()).toBe('connecting');
    });

    it('should return "open" for OPEN state', () => {
      mockWs.readyState = WebSocket.OPEN;
      connector.connect();
      
      expect(connector.getConnectionState()).toBe('open');
    });

    it('should return "closing" for CLOSING state', () => {
      mockWs.readyState = WebSocket.CLOSING;
      connector.connect();
      
      expect(connector.getConnectionState()).toBe('closing');
    });

    it('should return "closed" for CLOSED state', () => {
      mockWs.readyState = WebSocket.CLOSED;
      connector.connect();
      
      expect(connector.getConnectionState()).toBe('closed');
    });

    it('should return "disconnected" for invalid state', () => {
      mockWs.readyState = 999; // Invalid state
      connector.connect();
      
      expect(connector.getConnectionState()).toBe('disconnected');
    });
  });

  describe('setReconnectInterval()', () => {
    it('should update reconnect interval with valid value', () => {
      connector.setReconnectInterval(5000);
      expect(connector.reconnectInterval).toBe(5000);
    });

    it('should accept minimum value of 1ms', () => {
      connector.setReconnectInterval(1);
      expect(connector.reconnectInterval).toBe(1);
    });

    it('should accept large values', () => {
      connector.setReconnectInterval(60000);
      expect(connector.reconnectInterval).toBe(60000);
    });

    it('should reject zero value', () => {
      const originalInterval = connector.reconnectInterval;
      connector.setReconnectInterval(0);
      expect(connector.reconnectInterval).toBe(originalInterval);
    });

    it('should reject negative values', () => {
      const originalInterval = connector.reconnectInterval;
      connector.setReconnectInterval(-1000);
      expect(connector.reconnectInterval).toBe(originalInterval);
    });
  });

  describe('enableAutoReconnect() / disableAutoReconnect()', () => {
    it('should enable auto-reconnect', () => {
      connector.shouldReconnect = false;
      connector.enableAutoReconnect();
      expect(connector.shouldReconnect).toBe(true);
    });

    it('should disable auto-reconnect', () => {
      connector.shouldReconnect = true;
      connector.disableAutoReconnect();
      expect(connector.shouldReconnect).toBe(false);
    });

    it('should be idempotent', () => {
      connector.enableAutoReconnect();
      connector.enableAutoReconnect();
      expect(connector.shouldReconnect).toBe(true);

      connector.disableAutoReconnect();
      connector.disableAutoReconnect();
      expect(connector.shouldReconnect).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should allow manual reconnect with custom interval', async () => {
      connector.setReconnectInterval(100);
      connector.connect();
      
      // Simulate connection loss
      mockWs.readyState = WebSocket.CLOSED;
      if (mockWs.onclose) {
        mockWs.onclose({ code: 1000, reason: 'Normal closure' });
      }
      
      // Force reconnect with new interval
      connector.forceReconnect();
      
      expect(connector.reconnectInterval).toBe(100);
    });

    it('should disable auto-reconnect before disconnect', () => {
      connector.connect();
      connector.disableAutoReconnect();
      connector.disconnect(false); // Don't override shouldReconnect
      
      expect(connector.shouldReconnect).toBe(false);
    });

    it('should maintain state through reconnection cycle', () => {
      // Set custom interval and disable auto-reconnect
      connector.setReconnectInterval(2000);
      connector.disableAutoReconnect();
      
      connector.connect();
      connector.forceReconnect();
      
      // Settings should be preserved
      expect(connector.reconnectInterval).toBe(2000);
      expect(connector.shouldReconnect).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle forceReconnect with connection error', () => {
      global.WebSocket = vi.fn(() => {
        throw new Error('Connection failed');
      });
      
      connector.connect();
      expect(() => connector.forceReconnect()).not.toThrow();
    });

    it('should handle getConnectionState when ws is null', () => {
      connector.ws = null;
      expect(connector.getConnectionState()).toBe('disconnected');
    });
  });
});

describe('P2PSignalingClient - Connection Controls', () => {
  let client;
  let mockWs;

  beforeEach(async () => {
    // Mock WebSocket
    mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    global.WebSocket = vi.fn(() => mockWs);
    global.WebSocket.CONNECTING = 0;
    global.WebSocket.OPEN = 1;
    global.WebSocket.CLOSING = 2;
    global.WebSocket.CLOSED = 3;

    // Import dynamically to ensure fresh instance
    const { P2PSignalingClient } = await import('../../workplaces/p2p-console-viewer-lib/src/p2p-signaling-client.js');
    client = new P2PSignalingClient('ws://localhost:3000');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('forceReconnect()', () => {
    it('should close all P2P connections and reconnect', () => {
      client.connect();
      
      // Add mock peer
      const mockP2P = {
        close: vi.fn()
      };
      client.peers.set('peer1', mockP2P);
      
      client.forceReconnect();
      
      expect(mockP2P.close).toHaveBeenCalled();
      expect(client.peers.size).toBe(0);
    });

    it('should clear server state', () => {
      client.currentServerID = 'server-123';
      client.roomPeers = ['peer1', 'peer2'];
      
      client.forceReconnect();
      
      expect(client.currentServerID).toBeNull();
      expect(client.roomPeers).toEqual([]);
    });

    it('should rejoin room after reconnect if in a room', (done) => {
      client.currentRoom = 'test-room';
      client.connect();
      
      // Mock send to verify room join
      mockWs.send = vi.fn();
      
      client.forceReconnect();
      
      // Trigger onopen to simulate reconnection
      setTimeout(() => {
        if (mockWs.onopen) {
          mockWs.onopen({});
        }
        
        // Should attempt to rejoin room
        setTimeout(() => {
          expect(mockWs.send).toHaveBeenCalled();
          done();
        }, 10);
      }, 10);
    });
  });

  describe('Connection state methods', () => {
    it('should expose getConnectionState()', () => {
      expect(client.getConnectionState()).toBe('disconnected');
      
      client.connect();
      mockWs.readyState = WebSocket.OPEN;
      expect(client.getConnectionState()).toBe('open');
    });

    it('should expose isConnected()', () => {
      expect(client.isConnected()).toBe(false);
      
      client.connect();
      mockWs.readyState = WebSocket.OPEN;
      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Auto-reconnect control', () => {
    it('should expose setReconnectInterval()', () => {
      client.setReconnectInterval(5000);
      expect(client.ws.reconnectInterval).toBe(5000);
    });

    it('should expose enableAutoReconnect()', () => {
      client.ws.shouldReconnect = false;
      client.enableAutoReconnect();
      expect(client.ws.shouldReconnect).toBe(true);
    });

    it('should expose disableAutoReconnect()', () => {
      client.ws.shouldReconnect = true;
      client.disableAutoReconnect();
      expect(client.ws.shouldReconnect).toBe(false);
    });
  });

  describe('Integration with error handling', () => {
    it('should handle peer connection errors during forceReconnect', () => {
      const mockP2P = {
        close: vi.fn(() => {
          throw new Error('Close failed');
        })
      };
      client.peers.set('peer1', mockP2P);
      
      expect(() => client.forceReconnect()).not.toThrow();
      expect(client.peers.size).toBe(0);
    });
  });
});
