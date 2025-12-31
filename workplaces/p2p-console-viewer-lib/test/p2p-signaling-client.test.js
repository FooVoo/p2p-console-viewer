import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P2PSignalingClient } from '../src/p2p-signaling-client.js';

// Mock WebSocketConnector
class MockWebSocketConnector {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messageHandlers = [];
    this.openHandlers = [];
    this.readyCallbacks = [];
    this.connected = false;
  }

  connect() {
    setTimeout(() => {
      this.connected = true;
      this.readyCallbacks.forEach(cb => cb());
      this.openHandlers.forEach(h => h());
    }, 10);
  }

  send(message) {
    return this.connected;
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  onOpen(handler) {
    this.openHandlers.push(handler);
  }

  whenReady(callback) {
    if (this.connected) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  disconnect() {
    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }

  // Helper to simulate receiving a message
  simulateMessage(data) {
    const message = JSON.stringify(data);
    this.messageHandlers.forEach(h => h(message));
  }
}

// Mock P2PConnection
vi.mock('../src/p2p-connection.js', () => ({
  P2PConnection: class MockP2PConnection {
    constructor() {
      this.iceCandidateHandlers = [];
      this.offerHandlers = [];
      this.answerHandlers = [];
      this.messageHandlers = [];
      this.connectedHandlers = [];
    }

    onIceCandidate(handler) {
      this.iceCandidateHandlers.push(handler);
    }

    onOffer(handler) {
      this.offerHandlers.push(handler);
    }

    onAnswer(handler) {
      this.answerHandlers.push(handler);
    }

    onMessage(handler) {
      this.messageHandlers.push(handler);
    }

    onConnected(handler) {
      this.connectedHandlers.push(handler);
    }

    async initiate() {
      const offer = { type: 'offer', sdp: 'mock-offer-sdp' };
      this.offerHandlers.forEach(h => h(offer));
      return offer;
    }

    async receiveOffer(offer) {
      const answer = { type: 'answer', sdp: 'mock-answer-sdp' };
      this.answerHandlers.forEach(h => h(answer));
      return answer;
    }

    async receiveAnswer(answer) {
      // Mock implementation
    }

    async addIceCandidate(candidate) {
      // Mock implementation
    }

    send(message) {
      return true;
    }

    close() {
      // Mock implementation
    }
  }
}));

describe('P2PSignalingClient', () => {
  let mockWebSocketConnector;

  beforeEach(() => {
    // Create a fresh mock for each test
    mockWebSocketConnector = new MockWebSocketConnector('ws://localhost:3000');
    
    // Mock the WebSocketConnector import
    vi.doMock('../src/websocket-connector.js', () => ({
      WebSocketConnector: vi.fn(() => mockWebSocketConnector)
    }));
  });

  describe('constructor', () => {
    it('should create instance with URL', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      expect(client.ws).toBeDefined();
      expect(client.peers).toBeInstanceOf(Map);
      expect(client.currentServerID).toBeNull();
    });

    it('should accept room option', () => {
      const client = new P2PSignalingClient('ws://localhost:3000', { room: 'test-room' });
      expect(client.currentRoom).toBe('test-room');
    });

    it('should initialize without room by default', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      expect(client.currentRoom).toBeNull();
    });

    it('should initialize empty roomPeers array', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      expect(client.roomPeers).toEqual([]);
    });
  });

  describe('handleSignalingMessage', () => {
    it('should handle id message', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      await client.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      client.handleSignalingMessage({ type: 'id', id: 'test-id-123' });
      expect(client.currentServerID).toBe('test-id-123');
    });

    it('should handle room-joined message', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.handleSignalingMessage({ type: 'room-joined', room: 'lobby' });
      expect(client.currentRoom).toBe('lobby');
    });

    it('should handle room-left message', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.currentRoom = 'lobby';
      client.roomPeers = ['peer1', 'peer2'];
      
      client.handleSignalingMessage({ type: 'room-left', room: 'lobby' });
      
      expect(client.currentRoom).toBeNull();
      expect(client.roomPeers).toEqual([]);
    });

    it('should handle room-peers message', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const peers = ['peer1', 'peer2', 'peer3'];
      
      client.handleSignalingMessage({ type: 'room-peers', peers });
      
      expect(client.roomPeers).toEqual(peers);
    });

    it('should handle peer-joined message', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.roomPeers = ['peer1'];
      
      client.handleSignalingMessage({ type: 'peer-joined', peerId: 'peer2' });
      
      expect(client.roomPeers).toContain('peer2');
      expect(client.roomPeers).toHaveLength(2);
    });

    it('should not add duplicate peers on peer-joined', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.roomPeers = ['peer1'];
      
      client.handleSignalingMessage({ type: 'peer-joined', peerId: 'peer1' });
      
      expect(client.roomPeers).toEqual(['peer1']);
    });

    it('should handle peer-left message', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.roomPeers = ['peer1', 'peer2', 'peer3'];
      
      client.handleSignalingMessage({ type: 'peer-left', peerId: 'peer2' });
      
      expect(client.roomPeers).toEqual(['peer1', 'peer3']);
    });

    it('should create P2P connection on offer', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const offer = { type: 'offer', sdp: 'test-sdp' };
      
      client.handleSignalingMessage({ 
        type: 'offer', 
        from: 'remote-peer', 
        offer 
      });
      
      expect(client.peers.has('remote-peer')).toBe(true);
    });

    it('should handle answer from known peer', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const mockP2P = client.createP2PConnection('remote-peer');
      const receiveAnswerSpy = vi.spyOn(mockP2P, 'receiveAnswer');
      
      const answer = { type: 'answer', sdp: 'test-sdp' };
      client.handleSignalingMessage({ 
        type: 'answer', 
        from: 'remote-peer', 
        answer 
      });
      
      expect(receiveAnswerSpy).toHaveBeenCalledWith(answer);
    });

    it('should handle ICE candidate from known peer', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const mockP2P = client.createP2PConnection('remote-peer');
      const addIceCandidateSpy = vi.spyOn(mockP2P, 'addIceCandidate');
      
      const candidate = { candidate: 'test-candidate' };
      client.handleSignalingMessage({ 
        type: 'ice-candidate', 
        from: 'remote-peer', 
        candidate 
      });
      
      expect(addIceCandidateSpy).toHaveBeenCalledWith(candidate);
    });
  });

  describe('joinRoom', () => {
    it('should send join-room message', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      await client.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sendSpy = vi.spyOn(client.ws, 'send');
      client.joinRoom('test-room');
      
      expect(sendSpy).toHaveBeenCalledWith({
        type: 'join-room',
        room: 'test-room'
      });
    });

    it('should warn if room name is empty', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      client.joinRoom('');
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('leaveRoom', () => {
    it('should send leave-room message', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.currentRoom = 'test-room';
      await client.connect();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const sendSpy = vi.spyOn(client.ws, 'send');
      client.leaveRoom();
      
      expect(sendSpy).toHaveBeenCalledWith({
        type: 'leave-room'
      });
    });

    it('should warn if not in a room', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      client.leaveRoom();
      
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getRoomPeers', () => {
    it('should return copy of room peers array', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      client.roomPeers = ['peer1', 'peer2'];
      
      const peers = client.getRoomPeers();
      
      expect(peers).toEqual(['peer1', 'peer2']);
      expect(peers).not.toBe(client.roomPeers); // Should be a copy
    });
  });

  describe('initiateP2P', () => {
    it('should create P2P connection and initiate', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      const offer = await client.initiateP2P('remote-peer');
      
      expect(client.peers.has('remote-peer')).toBe(true);
      expect(offer).toEqual({ type: 'offer', sdp: 'mock-offer-sdp' });
    });
  });

  describe('sendMessage', () => {
    it('should send message to specific peer', async () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const mockP2P = client.createP2PConnection('remote-peer');
      const sendSpy = vi.spyOn(mockP2P, 'send');
      
      client.sendMessage('remote-peer', { text: 'hello' });
      
      expect(sendSpy).toHaveBeenCalledWith({ text: 'hello' });
    });

    it('should send to first peer when only message provided', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const mockP2P = client.createP2PConnection('remote-peer');
      const sendSpy = vi.spyOn(mockP2P, 'send');
      
      client.sendMessage({ text: 'hello' });
      
      expect(sendSpy).toHaveBeenCalledWith({ text: 'hello' });
    });

    it('should return false for unknown peer', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const result = client.sendMessage('unknown-peer', 'hello');
      expect(result).toBe(false);
    });
  });

  describe('disconnectPeer', () => {
    it('should close P2P connection and remove peer', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const mockP2P = client.createP2PConnection('remote-peer');
      const closeSpy = vi.spyOn(mockP2P, 'close');
      
      client.disconnectPeer('remote-peer');
      
      expect(closeSpy).toHaveBeenCalled();
      expect(client.peers.has('remote-peer')).toBe(false);
    });

    it('should handle disconnecting non-existent peer', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      expect(() => client.disconnectPeer('unknown')).not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('should close all peers and websocket', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      const mockP2P1 = client.createP2PConnection('peer1');
      const mockP2P2 = client.createP2PConnection('peer2');
      
      const close1Spy = vi.spyOn(mockP2P1, 'close');
      const close2Spy = vi.spyOn(mockP2P2, 'close');
      const wsDisconnectSpy = vi.spyOn(client.ws, 'disconnect');
      
      client.disconnect();
      
      expect(close1Spy).toHaveBeenCalled();
      expect(close2Spy).toHaveBeenCalled();
      expect(wsDisconnectSpy).toHaveBeenCalled();
      expect(client.peers.size).toBe(0);
    });
  });

  describe('room configuration', () => {
    it('should store room in constructor options', () => {
      const client = new P2PSignalingClient('ws://localhost:3000', { 
        room: 'auto-room' 
      });
      
      expect(client.currentRoom).toBe('auto-room');
    });

    it('should have null room when not specified', () => {
      const client = new P2PSignalingClient('ws://localhost:3000');
      
      expect(client.currentRoom).toBeNull();
    });
  });
});
