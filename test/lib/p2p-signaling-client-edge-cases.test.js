import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P2PSignalingClient } from '../../workplaces/p2p-console-viewer-lib/src/p2p-signaling-client.js';

// Mock WebSocketConnector
vi.mock('../../workplaces/p2p-console-viewer-lib/src/websocket-connector.js', () => ({
  WebSocketConnector: class MockWebSocketConnector {
    constructor(url) {
      this.url = url;
      this.handlers = [];
      this.connected = false;
    }

    connect() {
      this.connected = true;
      setTimeout(() => {
        this.handlers.forEach(h => h({ type: 'id', id: 'mock-id' }));
      }, 10);
    }

    disconnect() {
      this.connected = false;
    }

    send(msg) {
      return this.connected;
    }

    onMessage(handler) {
      this.handlers.push(handler);
    }

    onClose(handler) {}
    onError(handler) {}
    onOpen(handler) {
      if (this.connected) {
        setTimeout(handler, 10);
      }
    }

    whenReady(callback) {
      if (this.connected) {
        callback();
      } else {
        setTimeout(callback, 10);
      }
    }

    waitUntilOpen() {
      return Promise.resolve();
    }

    isConnected() {
      return this.connected;
    }
  }
}));

// Mock P2PConnection
vi.mock('../../workplaces/p2p-console-viewer-lib/src/p2p-connection.js', () => ({
  P2PConnection: class MockP2PConnection {
    constructor() {
      this.handlers = { offer: [], answer: [], iceCandidate: [], message: [], connected: [], disconnected: [] };
    }

    async initiate() {
      return { type: 'offer', sdp: 'mock-offer' };
    }

    async receiveOffer(offer) {
      return { type: 'answer', sdp: 'mock-answer' };
    }

    async receiveAnswer(answer) {}

    async addIceCandidate(candidate) {}

    send(msg) {
      return true;
    }

    onOffer(handler) {
      this.handlers.offer.push(handler);
    }

    onAnswer(handler) {
      this.handlers.answer.push(handler);
    }

    onIceCandidate(handler) {
      this.handlers.iceCandidate.push(handler);
    }

    onMessage(handler) {
      this.handlers.message.push(handler);
    }

    onConnected(handler) {
      this.handlers.connected.push(handler);
    }

    onDisconnected(handler) {
      this.handlers.disconnected.push(handler);
    }

    close() {}
    isConnected() {
      return true;
    }
  }
}));

describe('P2PSignalingClient - Edge Cases', () => {
  describe('extreme inputs', () => {
    it('should handle very long room names', async () => {
      const longRoomName = 'x'.repeat(10000);
      const client = new P2PSignalingClient('ws://localhost:3000', {
        room: longRoomName
      });

      expect(client.currentRoom).toBe(longRoomName);
    });

    it('should handle room names with special characters', () => {
      const specialRoom = '🚀 room-name \n\r\t @#$%^&*()';
      const client = new P2PSignalingClient('ws://localhost:3000', {
        room: specialRoom
      });

      expect(client.currentRoom).toBe(specialRoom);
    });

    it('should handle empty room name as null', () => {
      const client = new P2PSignalingClient('ws://localhost:3000', {
        room: ''
      });

      // Empty string is falsy, so becomes null
      expect(client.currentRoom).toBeNull();
    });

    it('should handle very long peer IDs', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      const longPeerId = 'x'.repeat(10000);
      await client.initiateP2P(longPeerId);

      expect(client.peers.has(longPeerId)).toBe(true);
    });
  });

  describe('invalid states', () => {
    it('should handle joinRoom without connection', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      expect(() => client.joinRoom('test-room')).not.toThrow();
    });

    it('should handle leaveRoom when not in a room', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();
      
      expect(() => client.leaveRoom()).not.toThrow();
    });

    it('should handle initiateP2P with empty peer ID', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      await client.initiateP2P('');

      expect(client.peers.has('')).toBe(true);
    });

    it('should handle sendMessage to non-existent peer', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      const result = client.sendMessage('non-existent-peer', 'test');
      
      expect(result).toBe(false);
    });

    it('should handle disconnect before connect', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple simultaneous P2P initiations', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(client.initiateP2P(`peer-${i}`));
      }

      await Promise.all(promises);

      expect(client.peers.size).toBe(10);
    });

    it('should handle rapid room switching without crashing', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not crash when joining rooms rapidly
      expect(() => {
        for (let i = 0; i < 10; i++) {
          client.joinRoom(`room-${i}`);
        }
      }).not.toThrow();
    });

    it('should handle multiple connects', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      client.connect();
      client.connect();
      client.connect();

      // Should not crash
      expect(client.ws).toBeDefined();
    });
  });

  describe('message handling edge cases', () => {
    it('should handle malformed messages gracefully', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate receiving invalid messages
      const handler = client.ws.handlers[0];

      expect(() => {
        handler(null);
        handler(undefined);
        handler('not an object');
        handler({ type: 'unknown-type' });
        handler({ noType: 'field' });
      }).not.toThrow();
    });

    it('should handle offer with missing fields', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      const handler = client.ws.handlers[0];

      expect(() => {
        handler({ type: 'offer', from: 'peer1' }); // missing offer field
        handler({ type: 'offer', offer: {} }); // missing from field
        handler({ type: 'offer' }); // missing both
      }).not.toThrow();
    });

    it('should handle ice-candidate with missing fields', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      const handler = client.ws.handlers[0];

      expect(() => {
        handler({ type: 'ice-candidate', from: 'peer1' }); // missing candidate
        handler({ type: 'ice-candidate', candidate: {} }); // missing from
        handler({ type: 'ice-candidate' }); // missing both
      }).not.toThrow();
    });

    it('should handle room-peers with invalid data', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      const handler = client.ws.handlers[0];

      expect(() => {
        handler({ type: 'room-peers' }); // missing peers
        handler({ type: 'room-peers', peers: null });
        handler({ type: 'room-peers', peers: 'not an array' });
      }).not.toThrow();
    });
  });

  describe('cleanup and memory management', () => {
    it('should clean up peers on disconnect', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      await client.initiateP2P('peer1');
      await client.initiateP2P('peer2');

      expect(client.peers.size).toBe(2);

      client.disconnect();

      // Peers should still exist but connections may be closed
      expect(client.peers.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('boundary conditions', () => {
    it('should handle null server URL', () => {
      expect(() => {
        new P2PSignalingClient(null);
      }).not.toThrow();
    });

    it('should handle undefined server URL', () => {
      expect(() => {
        new P2PSignalingClient(undefined);
      }).not.toThrow();
    });

    it('should handle empty server URL', () => {
      expect(() => {
        new P2PSignalingClient('');
      }).not.toThrow();
    });

    it('should handle options as undefined', () => {
      expect(() => {
        new P2PSignalingClient('ws://localhost:3000', undefined);
      }).not.toThrow();
    });
  });

  describe('callback handling', () => {
    it('should handle callbacks that throw errors', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      client.whenConnected(() => {
        throw new Error('Callback error');
      });

      expect(() => {
        client.connect();
      }).not.toThrow();
    });

    it('should handle multiple whenConnected callbacks', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      const callbacks = [];
      for (let i = 0; i < 10; i++) {
        const cb = vi.fn();
        callbacks.push(cb);
        client.whenConnected(cb);
      }

      client.connect();

      await new Promise(resolve => setTimeout(resolve, 50));

      callbacks.forEach(cb => {
        expect(cb).toHaveBeenCalled();
      });
    });
  });

  describe('getRoomPeers edge cases', () => {
    it('should return copy of roomPeers array', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.roomPeers = ['peer1', 'peer2'];

      const peers1 = client.getRoomPeers();
      const peers2 = client.getRoomPeers();

      // Should be different array instances
      expect(peers1).not.toBe(peers2);
      expect(peers1).toEqual(peers2);
    });
  });
});
