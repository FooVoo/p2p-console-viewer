import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleP2PClient } from '../../workplaces/p2p-console-viewer-lib/src/console-p2p-client.js';
import { P2pMessageHelper } from '../../workplaces/p2p-console-viewer-lib/src/p2p-message-helper.js';

// ─── Mocks ─────────────────────────────────────────────────────────────────

/**
 * Minimal mock of P2PSignalingClient.
 * We replace client._signalingClient after construction for full control.
 */
class MockSignalingClient {
  constructor() {
    this.connected = false;
    this.room = null;
    this.peers = ['peer-a', 'peer-b'];
    this.peerMessageHandlers = [];
    this.errorHandlers = [];
    this.peerErrorHandlers = [];
    this.sentMessages = [];
    this.currentRoom = null;
    this.currentServerID = null;
  }

  connect() { this.connected = true; }
  disconnect() { this.connected = false; }
  isConnected() { return this.connected; }
  getConnectionState() { return this.connected ? 'open' : 'disconnected'; }
  joinRoom(name) { this.currentRoom = name; return true; }
  leaveRoom() { this.currentRoom = null; return true; }
  getRoomPeers() { return [...this.peers]; }

  sendMessage(peerId, message) {
    this.sentMessages.push({ peerId, message });
    return true;
  }

  onPeerMessage(handler) { this.peerMessageHandlers.push(handler); }
  onError(handler) { this.errorHandlers.push(handler); }
  onPeerError(handler) { this.peerErrorHandlers.push(handler); }

  // Test helper: simulate a raw data-channel message arriving from a peer
  simulatePeerMessage(peerId, rawMessage) {
    this.peerMessageHandlers.forEach(h => h(peerId, rawMessage));
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Create a ConsoleP2PClient and immediately replace its internal signaling
 * client with the provided mock so we can inspect calls without WebSockets.
 */
function makeClient(mockSig) {
  // We pass a dummy URL; the real signaling client is swapped out immediately.
  const client = new ConsoleP2PClient('ws://localhost:3000');
  // Re-wire the mock into the already-constructed client.
  // The constructor registered an onPeerMessage handler on the original
  // _signalingClient, so we need to wire the same hook on our mock.
  client._signalingClient = mockSig;

  // Re-register the internal onPeerMessage callback on the mock so the
  // handler chain works correctly in tests.
  const originalOnPeerMessage = ConsoleP2PClient.prototype._rewireOnPeerMessage;
  if (originalOnPeerMessage) {
    originalOnPeerMessage.call(client);
  } else {
    // Manually replicate the constructor wiring:
    mockSig.onPeerMessage((peerId, rawMessage) => {
      const msg = P2pMessageHelper.parse(rawMessage);
      if (msg && P2pMessageHelper.isConsoleMessage(msg)) {
        client._consoleMessageHandlers.forEach(h => {
          try { h(peerId, msg); } catch { /* noop */ }
        });
      }
    });
  }

  return client;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ConsoleP2PClient', () => {
  let mock;
  let client;
  let originalConsole;

  beforeEach(() => {
    mock = new MockSignalingClient();
    client = makeClient(mock);

    // Save real console methods so we can restore even if a test fails.
    originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
  });

  afterEach(() => {
    // Always restore console to prevent bleed between tests.
    client.stop();
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });

  // ─── construction ───────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should initialize isActive as false', () => {
      expect(client.isActive).toBe(false);
    });

    it('should initialize _consoleMessageHandlers as empty array', () => {
      expect(client._consoleMessageHandlers).toEqual([]);
    });

    it('should expose currentRoom from signaling client', () => {
      mock.currentRoom = 'test-room';
      expect(client.currentRoom).toBe('test-room');
    });

    it('should expose currentServerID from signaling client', () => {
      mock.currentServerID = 'server-id-123';
      expect(client.currentServerID).toBe('server-id-123');
    });
  });

  // ─── connect / disconnect ───────────────────────────────────────────────

  describe('connect()', () => {
    it('should delegate to the signaling client', () => {
      const spy = vi.spyOn(mock, 'connect');
      client.connect();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect()', () => {
    it('should stop console forwarding before disconnecting', () => {
      client.start();
      expect(client.isActive).toBe(true);
      client.disconnect();
      expect(client.isActive).toBe(false);
    });

    it('should delegate to the signaling client', () => {
      const spy = vi.spyOn(mock, 'disconnect');
      client.disconnect();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // ─── start / stop ───────────────────────────────────────────────────────

  describe('start()', () => {
    it('should set isActive to true', () => {
      client.start();
      expect(client.isActive).toBe(true);
    });

    it('should patch the global console', () => {
      const originalLog = console.log;
      client.start();
      expect(console.log).not.toBe(originalLog);
    });

    it('should be idempotent (calling twice is safe)', () => {
      client.start();
      const patchedLog = console.log;
      client.start();
      // Console reference should not change on second call
      expect(console.log).toBe(patchedLog);
      expect(client.isActive).toBe(true);
    });
  });

  describe('stop()', () => {
    it('should set isActive to false', () => {
      client.start();
      client.stop();
      expect(client.isActive).toBe(false);
    });

    it('should restore the original console methods (no longer routes through patch)', () => {
      const spy = vi.fn();
      client.start();
      // sanity: intercept fires
      console.log('during');
      expect(mock.sentMessages.length).toBeGreaterThan(0);
      mock.sentMessages.length = 0; // clear

      client.stop();
      // After stop, a console.log must NOT produce any sent messages
      console.log('after stop');
      expect(mock.sentMessages).toHaveLength(0);
      void spy; // unused
    });

    it('should be idempotent (calling when inactive is safe)', () => {
      expect(() => client.stop()).not.toThrow();
    });
  });

  // ─── console forwarding ─────────────────────────────────────────────────

  describe('console forwarding (start -> send)', () => {
    it('should send a message for every console.log call', () => {
      client.start();
      console.log('hello world');
      // mock.peers = ['peer-a', 'peer-b'] so two sends
      expect(mock.sentMessages).toHaveLength(2);
      expect(mock.sentMessages[0].peerId).toBe('peer-a');
      expect(mock.sentMessages[1].peerId).toBe('peer-b');
    });

    it('should send a serialised P2pMessageHelper message', () => {
      client.start();
      console.warn('something went wrong');

      const raw = mock.sentMessages[0].message;
      const parsed = P2pMessageHelper.parse(raw);

      expect(P2pMessageHelper.isConsoleMessage(parsed)).toBe(true);
      expect(parsed.level).toBe('warn');
      expect(parsed.text).toContain('something went wrong');
    });

    it('should not send any messages when stopped', () => {
      client.start();
      client.stop();
      console.log('after stop');
      expect(mock.sentMessages).toHaveLength(0);
    });

    it('should forward all five console levels', () => {
      client.start();
      // Each call sends to 2 mock peers, so 5 × 2 = 10 total
      console.log('log');
      console.info('info');
      console.warn('warn');
      console.error('error');
      console.debug('debug');
      expect(mock.sentMessages).toHaveLength(10);

      const levels = mock.sentMessages
        .filter(m => m.peerId === 'peer-a')
        .map(m => P2pMessageHelper.parse(m.message).level);
      expect(levels).toEqual(['log', 'info', 'warn', 'error', 'debug']);
    });

    it('should include namespace in forwarded messages when provided', () => {
      const c = new ConsoleP2PClient('ws://localhost:3000', { namespace: 'my-app' });
      c._signalingClient = mock;
      // Re-wire peer message handler on the new mock
      mock.onPeerMessage((peerId, raw) => {
        const msg = P2pMessageHelper.parse(raw);
        if (msg && P2pMessageHelper.isConsoleMessage(msg)) {
          c._consoleMessageHandlers.forEach(h => { try { h(peerId, msg); } catch { /* noop */ } });
        }
      });

      c.start();
      console.log('with namespace');
      c.stop();

      const parsed = P2pMessageHelper.parse(mock.sentMessages[0].message);
      expect(parsed.namespace).toBe('my-app');
    });

    it('should send nothing when there are no room peers', () => {
      mock.peers = [];
      client.start();
      console.log('nobody home');
      expect(mock.sentMessages).toHaveLength(0);
    });
  });

  // ─── receiving console messages ─────────────────────────────────────────

  describe('onConsoleMessage()', () => {
    it('should call handler when a valid console message arrives from a peer', () => {
      const handler = vi.fn();
      client.onConsoleMessage(handler);

      const msg = new P2pMessageHelper().buildMessage('log', ['hello from peer']);
      mock.simulatePeerMessage('peer-x', P2pMessageHelper.serialize(msg));

      expect(handler).toHaveBeenCalledTimes(1);
      const [peerId, receivedMsg] = handler.mock.calls[0];
      expect(peerId).toBe('peer-x');
      expect(receivedMsg.level).toBe('log');
      expect(receivedMsg.text).toContain('hello from peer');
    });

    it('should not call handler for non-console P2P messages', () => {
      const handler = vi.fn();
      client.onConsoleMessage(handler);

      mock.simulatePeerMessage('peer-x', JSON.stringify({ arbitrary: 'data' }));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should not call handler for malformed (non-JSON) messages', () => {
      const handler = vi.fn();
      client.onConsoleMessage(handler);

      mock.simulatePeerMessage('peer-x', 'not-json{{{{');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support multiple handlers', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      client.onConsoleMessage(h1);
      client.onConsoleMessage(h2);

      const msg = new P2pMessageHelper().buildMessage('error', ['boom']);
      mock.simulatePeerMessage('peer-x', P2pMessageHelper.serialize(msg));

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('should not let a throwing handler break other handlers', () => {
      const bad = vi.fn(() => { throw new Error('handler exploded'); });
      const good = vi.fn();
      client.onConsoleMessage(bad);
      client.onConsoleMessage(good);

      const msg = new P2pMessageHelper().buildMessage('log', ['test']);
      mock.simulatePeerMessage('peer-x', P2pMessageHelper.serialize(msg));

      expect(bad).toHaveBeenCalledTimes(1);
      expect(good).toHaveBeenCalledTimes(1);
    });
  });

  // ─── room management proxies ────────────────────────────────────────────

  describe('room management', () => {
    it('joinRoom() should delegate to signaling client', () => {
      const spy = vi.spyOn(mock, 'joinRoom');
      client.joinRoom('lobby');
      expect(spy).toHaveBeenCalledWith('lobby');
    });

    it('leaveRoom() should delegate to signaling client', () => {
      const spy = vi.spyOn(mock, 'leaveRoom');
      client.leaveRoom();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('getRoomPeers() should return peers from signaling client', () => {
      mock.peers = ['p1', 'p2', 'p3'];
      expect(client.getRoomPeers()).toEqual(['p1', 'p2', 'p3']);
    });
  });

  // ─── connection state proxies ────────────────────────────────────────────

  describe('connection state', () => {
    it('isConnected() should reflect signaling client state', () => {
      expect(client.isConnected()).toBe(false);
      mock.connected = true;
      expect(client.isConnected()).toBe(true);
    });

    it('getConnectionState() should reflect signaling client state', () => {
      expect(client.getConnectionState()).toBe('disconnected');
      mock.connected = true;
      expect(client.getConnectionState()).toBe('open');
    });
  });

  // ─── error handler proxies ───────────────────────────────────────────────

  describe('error handlers', () => {
    it('onError() should delegate to signaling client', () => {
      const spy = vi.spyOn(mock, 'onError');
      const h = vi.fn();
      client.onError(h);
      expect(spy).toHaveBeenCalledWith(h);
    });

    it('onPeerError() should delegate to signaling client', () => {
      const spy = vi.spyOn(mock, 'onPeerError');
      const h = vi.fn();
      client.onPeerError(h);
      expect(spy).toHaveBeenCalledWith(h);
    });
  });
});
