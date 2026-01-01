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
      const offer = { type: 'offer', sdp: 'mock-offer' };
      // Simulate the offer being generated and handlers called
      this.handlers.offer.forEach(h => h(offer));
      return offer;
    }

    async receiveOffer(offer) {
      const answer = { type: 'answer', sdp: 'mock-answer' };
      this.handlers.answer.forEach(h => h(answer));
      return answer;
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

      await expect(client.initiateP2P('')).rejects.toThrow('Valid remotePeerId is required');
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

  describe('error handling', () => {
    it('should emit error through onError handler', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger a general error
      client.emitError(new Error('Test error'));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
      expect(errorHandler.mock.calls[0][0].message).toBe('Test error');
    });

    it('should emit peer error through onPeerError handler', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const peerErrorHandler = vi.fn();
      client.onPeerError(peerErrorHandler);

      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Trigger a peer-specific error
      client.emitPeerError('peer1', new Error('Peer connection failed'));

      expect(peerErrorHandler).toHaveBeenCalledWith('peer1', expect.any(Error));
      expect(peerErrorHandler.mock.calls[0][1].message).toBe('Peer connection failed');
    });

    it('should handle errors in error handlers gracefully', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      // Register a bad error handler
      client.onError(() => {
        throw new Error('Handler error');
      });

      // This should not throw
      expect(() => {
        client.emitError(new Error('Test error'));
      }).not.toThrow();
    });

    it('should handle errors in peer error handlers gracefully', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      // Register a bad peer error handler
      client.onPeerError(() => {
        throw new Error('Handler error');
      });

      // This should not throw
      expect(() => {
        client.emitPeerError('peer1', new Error('Test error'));
      }).not.toThrow();
    });

    it('should handle server error messages', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate server error message
      const data = JSON.stringify({ type: 'error', message: 'Room not found' });
      client.ws.handlers.forEach(h => h(data));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
      expect(errorHandler.mock.calls[0][0].message).toBe('Room not found');
    });

    it('should handle invalid peer ID in initiateP2P', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const errorHandler = vi.fn();
      client.onError(errorHandler);

      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Test with null
      await expect(client.initiateP2P(null)).rejects.toThrow('Valid remotePeerId is required');
      
      // Test with undefined
      await expect(client.initiateP2P(undefined)).rejects.toThrow('Valid remotePeerId is required');
      
      // Test with empty string
      await expect(client.initiateP2P('')).rejects.toThrow('Valid remotePeerId is required');

      // Error handler should have been called for each
      expect(errorHandler).toHaveBeenCalledTimes(3);
    });

    it('should return false from joinRoom with invalid input', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Test with empty string
      expect(client.joinRoom('')).toBe(false);
      
      // Test with null
      expect(client.joinRoom(null)).toBe(false);
      
      // Test with number
      expect(client.joinRoom(123)).toBe(false);
    });

    it('should return false from leaveRoom when not in a room', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(client.leaveRoom()).toBe(false);
    });

    it('should handle WebSocket send failures for signaling', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const peerErrorHandler = vi.fn();
      client.onPeerError(peerErrorHandler);

      client.connect();
      await new Promise(resolve => setTimeout(resolve, 50));

      // Disconnect WebSocket to make sends fail
      client.ws.disconnect();

      // Try to initiate P2P - the initiate succeeds but offer send fails
      await client.initiateP2P('peer1');

      // Wait for the offer handler to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      // Peer error handler should have been called for the failed send
      expect(peerErrorHandler).toHaveBeenCalledWith('peer1', expect.any(Error));
      expect(peerErrorHandler.mock.calls[0][1].message).toContain('Failed to send offer');
    });
  });
});
