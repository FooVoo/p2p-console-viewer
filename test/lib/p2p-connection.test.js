import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P2PConnection } from '../../workplaces/p2p-console-viewer-lib/src/p2p-connection.js';

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  constructor(config) {
    this.config = config;
    this.localDescription = null;
    this.remoteDescription = null;
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.onicecandidate = null;
    this.onconnectionstatechange = null;
    this.oniceconnectionstatechange = null;
    this.ondatachannel = null;
    this._dataChannels = [];
  }

  async createOffer() {
    return {
      type: 'offer',
      sdp: 'mock-offer-sdp',
    };
  }

  async createAnswer() {
    return {
      type: 'answer',
      sdp: 'mock-answer-sdp',
    };
  }

  async setLocalDescription(desc) {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc) {
    this.remoteDescription = desc;
  }

  createDataChannel(label) {
    const channel = new MockRTCDataChannel(label);
    this._dataChannels.push(channel);
    return channel;
  }

  async addIceCandidate(candidate) {
    // Mock implementation
  }

  close() {
    this.connectionState = 'closed';
  }

  async getStats() {
    return new Map();
  }
}

class MockRTCDataChannel {
  constructor(label) {
    this.label = label;
    this.readyState = 'connecting';
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
  }

  send(data) {
    if (this.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }
  }

  close() {
    this.readyState = 'closed';
    if (this.onclose) this.onclose();
  }
}

class MockRTCSessionDescription {
  constructor(desc) {
    this.type = desc.type;
    this.sdp = desc.sdp;
  }
}

class MockRTCIceCandidate {
  constructor(candidate) {
    this.candidate = candidate.candidate;
  }
}

describe('P2PConnection', () => {
  let originalRTCPeerConnection;
  let originalRTCSessionDescription;
  let originalRTCIceCandidate;

  beforeEach(() => {
    // Mock WebRTC globals
    originalRTCPeerConnection = global.RTCPeerConnection;
    originalRTCSessionDescription = global.RTCSessionDescription;
    originalRTCIceCandidate = global.RTCIceCandidate;

    global.RTCPeerConnection = MockRTCPeerConnection;
    global.RTCSessionDescription = MockRTCSessionDescription;
    global.RTCIceCandidate = MockRTCIceCandidate;
  });

  afterEach(() => {
    // Restore originals
    if (originalRTCPeerConnection) {
      global.RTCPeerConnection = originalRTCPeerConnection;
    }
    if (originalRTCSessionDescription) {
      global.RTCSessionDescription = originalRTCSessionDescription;
    }
    if (originalRTCIceCandidate) {
      global.RTCIceCandidate = originalRTCIceCandidate;
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const p2p = new P2PConnection();
      
      expect(p2p.config).toBeDefined();
      expect(p2p.config.iceServers).toBeDefined();
      expect(p2p.config.iceServers.length).toBeGreaterThan(0);
    });

    it('should accept custom config', () => {
      const customConfig = {
        iceServers: [{ urls: 'stun:custom.server.com' }],
      };
      
      const p2p = new P2PConnection(customConfig);
      
      expect(p2p.config.iceServers).toEqual(customConfig.iceServers);
    });

    it('should initialize with null peer connection', () => {
      const p2p = new P2PConnection();
      expect(p2p.peerConnection).toBeNull();
    });

    it('should initialize with null data channel', () => {
      const p2p = new P2PConnection();
      expect(p2p.dataChannel).toBeNull();
    });

    it('should initialize isInitiator as false', () => {
      const p2p = new P2PConnection();
      expect(p2p.isInitiator).toBe(false);
    });

    it('should initialize empty handler arrays', () => {
      const p2p = new P2PConnection();
      
      expect(p2p.onMessageHandlers).toEqual([]);
      expect(p2p.onConnectedHandlers).toEqual([]);
      expect(p2p.onDisconnectedHandlers).toEqual([]);
      expect(p2p.onIceCandidateHandlers).toEqual([]);
      expect(p2p.onOfferHandlers).toEqual([]);
      expect(p2p.onAnswerHandlers).toEqual([]);
      expect(p2p.onDataChannelHandlers).toEqual([]);
    });
  });

  describe('initiate', () => {
    it('should create peer connection as initiator', async () => {
      const p2p = new P2PConnection();
      
      await p2p.initiate();
      
      expect(p2p.isInitiator).toBe(true);
      expect(p2p.peerConnection).not.toBeNull();
    });

    it('should create data channel', async () => {
      const p2p = new P2PConnection();
      
      await p2p.initiate();
      
      expect(p2p.dataChannel).not.toBeNull();
      expect(p2p.dataChannel.label).toBe('dataChannel');
    });

    it('should create and return offer', async () => {
      const p2p = new P2PConnection();
      
      const offer = await p2p.initiate();
      
      expect(offer).toBeDefined();
      expect(offer.type).toBe('offer');
      expect(offer.sdp).toBeDefined();
    });

    it('should set local description', async () => {
      const p2p = new P2PConnection();
      
      await p2p.initiate();
      
      expect(p2p.peerConnection.localDescription).not.toBeNull();
      expect(p2p.peerConnection.localDescription.type).toBe('offer');
    });

    it('should call offer handlers', async () => {
      const p2p = new P2PConnection();
      const offerHandler = vi.fn();
      p2p.onOffer(offerHandler);
      
      await p2p.initiate();
      
      expect(offerHandler).toHaveBeenCalledTimes(1);
      expect(offerHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'offer',
      }));
    });
  });

  describe('receiveOffer', () => {
    it('should create peer connection as non-initiator', async () => {
      const p2p = new P2PConnection();
      const offer = { type: 'offer', sdp: 'test-offer-sdp' };
      
      await p2p.receiveOffer(offer);
      
      expect(p2p.isInitiator).toBe(false);
      expect(p2p.peerConnection).not.toBeNull();
    });

    it('should set remote description', async () => {
      const p2p = new P2PConnection();
      const offer = { type: 'offer', sdp: 'test-offer-sdp' };
      
      await p2p.receiveOffer(offer);
      
      expect(p2p.peerConnection.remoteDescription).not.toBeNull();
      expect(p2p.peerConnection.remoteDescription.type).toBe('offer');
    });

    it('should create and return answer', async () => {
      const p2p = new P2PConnection();
      const offer = { type: 'offer', sdp: 'test-offer-sdp' };
      
      const answer = await p2p.receiveOffer(offer);
      
      expect(answer).toBeDefined();
      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBeDefined();
    });

    it('should set local description', async () => {
      const p2p = new P2PConnection();
      const offer = { type: 'offer', sdp: 'test-offer-sdp' };
      
      await p2p.receiveOffer(offer);
      
      expect(p2p.peerConnection.localDescription).not.toBeNull();
      expect(p2p.peerConnection.localDescription.type).toBe('answer');
    });

    it('should call answer handlers', async () => {
      const p2p = new P2PConnection();
      const answerHandler = vi.fn();
      p2p.onAnswer(answerHandler);
      
      const offer = { type: 'offer', sdp: 'test-offer-sdp' };
      await p2p.receiveOffer(offer);
      
      expect(answerHandler).toHaveBeenCalledTimes(1);
      expect(answerHandler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'answer',
      }));
    });
  });

  describe('receiveAnswer', () => {
    it('should set remote description', async () => {
      const p2p = new P2PConnection();
      await p2p.initiate();
      
      const answer = { type: 'answer', sdp: 'test-answer-sdp' };
      await p2p.receiveAnswer(answer);
      
      expect(p2p.peerConnection.remoteDescription).not.toBeNull();
      expect(p2p.peerConnection.remoteDescription.type).toBe('answer');
    });

    it('should throw error if peer connection not initialized', async () => {
      const p2p = new P2PConnection();
      const answer = { type: 'answer', sdp: 'test-answer-sdp' };
      
      await expect(p2p.receiveAnswer(answer)).rejects.toThrow(
        'Peer connection not initialized'
      );
    });
  });

  describe('addIceCandidate', () => {
    it('should add ICE candidate', async () => {
      const p2p = new P2PConnection();
      await p2p.initiate();
      
      const candidate = { candidate: 'test-candidate' };
      
      await expect(p2p.addIceCandidate(candidate)).resolves.not.toThrow();
    });

    it('should throw error if peer connection not initialized', async () => {
      const p2p = new P2PConnection();
      const candidate = { candidate: 'test-candidate' };
      
      await expect(p2p.addIceCandidate(candidate)).rejects.toThrow(
        'Peer connection not initialized'
      );
    });
  });

  describe('send', () => {
    it('should send string message when channel is open', () => {
      const p2p = new P2PConnection();
      p2p.dataChannel = new MockRTCDataChannel('test');
      p2p.dataChannel.readyState = 'open';
      
      const result = p2p.send('test message');
      
      expect(result).toBe(true);
    });

    it('should send object as JSON', () => {
      const p2p = new P2PConnection();
      p2p.dataChannel = new MockRTCDataChannel('test');
      p2p.dataChannel.readyState = 'open';
      
      const sendSpy = vi.spyOn(p2p.dataChannel, 'send');
      
      p2p.send({ type: 'test', data: 'value' });
      
      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify({ type: 'test', data: 'value' }));
    });

    it('should return false if data channel not initialized', () => {
      const p2p = new P2PConnection();
      
      const result = p2p.send('test');
      
      expect(result).toBe(false);
    });

    it('should return false if data channel not open', () => {
      const p2p = new P2PConnection();
      p2p.dataChannel = new MockRTCDataChannel('test');
      p2p.dataChannel.readyState = 'connecting';
      
      const result = p2p.send('test');
      
      expect(result).toBe(false);
    });
  });

  describe('handler registration', () => {
    it('should register message handler', () => {
      const p2p = new P2PConnection();
      const handler = vi.fn();
      
      p2p.onMessage(handler);
      
      expect(p2p.onMessageHandlers).toContain(handler);
    });

    it('should register connected handler', () => {
      const p2p = new P2PConnection();
      const handler = vi.fn();
      
      p2p.onConnected(handler);
      
      expect(p2p.onConnectedHandlers).toContain(handler);
    });

    it('should register disconnected handler', () => {
      const p2p = new P2PConnection();
      const handler = vi.fn();
      
      p2p.onDisconnected(handler);
      
      expect(p2p.onDisconnectedHandlers).toContain(handler);
    });

    it('should register ICE candidate handler', () => {
      const p2p = new P2PConnection();
      const handler = vi.fn();
      
      p2p.onIceCandidate(handler);
      
      expect(p2p.onIceCandidateHandlers).toContain(handler);
    });

    it('should register data channel handler', () => {
      const p2p = new P2PConnection();
      const handler = vi.fn();
      
      p2p.onDataChannel(handler);
      
      expect(p2p.onDataChannelHandlers).toContain(handler);
    });
  });

  describe('close', () => {
    it('should close data channel and peer connection', async () => {
      const p2p = new P2PConnection();
      await p2p.initiate();
      
      const dataChannelSpy = vi.spyOn(p2p.dataChannel, 'close');
      const peerConnectionSpy = vi.spyOn(p2p.peerConnection, 'close');
      
      p2p.close();
      
      expect(dataChannelSpy).toHaveBeenCalled();
      expect(peerConnectionSpy).toHaveBeenCalled();
      expect(p2p.dataChannel).toBeNull();
      expect(p2p.peerConnection).toBeNull();
    });

    it('should handle close when connections not initialized', () => {
      const p2p = new P2PConnection();
      
      expect(() => p2p.close()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return falsy when not initialized', () => {
      const p2p = new P2PConnection();
      
      expect(p2p.isConnected()).toBeFalsy();
    });

    it('should return true when connected and channel open', async () => {
      const p2p = new P2PConnection();
      await p2p.initiate();
      
      p2p.peerConnection.connectionState = 'connected';
      p2p.dataChannel.readyState = 'open';
      
      expect(p2p.isConnected()).toBe(true);
    });

    it('should return falsy when connected but channel not open', async () => {
      const p2p = new P2PConnection();
      await p2p.initiate();
      
      p2p.peerConnection.connectionState = 'connected';
      p2p.dataChannel.readyState = 'connecting';
      
      expect(p2p.isConnected()).toBeFalsy();
    });
  });

  describe('getStats', () => {
    it('should return stats from peer connection', async () => {
      const p2p = new P2PConnection();
      await p2p.initiate();
      
      const stats = await p2p.getStats();
      
      expect(stats).not.toBeNull();
    });

    it('should return null when peer connection not initialized', async () => {
      const p2p = new P2PConnection();
      
      const stats = await p2p.getStats();
      
      expect(stats).toBeNull();
    });
  });
});
