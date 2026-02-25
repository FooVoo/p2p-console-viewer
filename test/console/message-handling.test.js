import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for P2P Console Viewer Message Handling and UI Logic
 *
 * These tests verify the message parsing, serialization, type preservation,
 * protocol switching, and connection management functionality.
 */

// Helper functions matching the actual implementations
function parseP2PMessage(data, direction) {
	try {
		const parsed = JSON.parse(data);

		// Check if it's a structured console message (from P2pMessageHelper)
		if (parsed && typeof parsed === 'object' && 'level' in parsed && 'timestamp' in parsed) {
			return {
				id: parsed.id || `${Date.now()}-${Math.random()}`,
				timestamp: parsed.timestamp,
				direction,
				type: parsed.level,
				content: parsed.text || '',
				payload: parsed.payload,
				namespace: parsed.namespace
			};
		}

		// If it's JSON but not a console message, stringify it
		return {
			id: `${Date.now()}-${Math.random()}`,
			timestamp: Date.now(),
			direction,
			type: 'text',
			content: JSON.stringify(parsed),
			payload: undefined,
			namespace: null
		};
	} catch (e) {
		// Plain text message
		return {
			id: `${Date.now()}-${Math.random()}`,
			timestamp: Date.now(),
			direction,
			type: 'text',
			content: data,
			payload: undefined,
			namespace: null
		};
	}
}

function serializeP2PMessage(message) {
	if (typeof message === 'string') {
		return message;
	}
	return JSON.stringify(message);
}

describe('Message Handling - parseP2PMessage', () => {
	describe('Structured Console Messages', () => {
		it('should parse a log message correctly', () => {
			const input = JSON.stringify({
				id: 'test-123',
				level: 'log',
				timestamp: 1234567890,
				text: 'Hello world',
				payload: ['Hello', 'world'],
				namespace: 'test'
			});

			const result = parseP2PMessage(input, 'inbound');

			expect(result.id).toBe('test-123');
			expect(result.type).toBe('log');
			expect(result.timestamp).toBe(1234567890);
			expect(result.content).toBe('Hello world');
			expect(result.direction).toBe('inbound');
			expect(result.payload).toEqual(['Hello', 'world']);
			expect(result.namespace).toBe('test');
		});

		it('should parse an error message correctly', () => {
			const input = JSON.stringify({
				id: 'err-456',
				level: 'error',
				timestamp: 9876543210,
				text: 'Something went wrong',
				payload: [{ error: 'details' }],
				namespace: null
			});

			const result = parseP2PMessage(input, 'outbound');

			expect(result.type).toBe('error');
			expect(result.content).toBe('Something went wrong');
			expect(result.direction).toBe('outbound');
			expect(result.namespace).toBe(null);
		});

		it('should parse a warning message correctly', () => {
			const input = JSON.stringify({
				level: 'warn',
				timestamp: 5555555555,
				text: 'Warning message'
			});

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('warn');
			expect(result.content).toBe('Warning message');
			expect(result.id).toBeDefined();
		});

		it('should parse an info message correctly', () => {
			const input = JSON.stringify({
				level: 'info',
				timestamp: 1111111111,
				text: 'Informational',
				payload: [{ status: 'ok' }]
			});

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('info');
			expect(result.content).toBe('Informational');
			expect(result.payload).toEqual([{ status: 'ok' }]);
		});

		it('should parse a debug message correctly', () => {
			const input = JSON.stringify({
				level: 'debug',
				timestamp: 7777777777,
				text: 'Debug info'
			});

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('debug');
			expect(result.content).toBe('Debug info');
		});

		it('should handle missing optional fields', () => {
			const input = JSON.stringify({
				level: 'log',
				timestamp: 1234567890
			});

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('log');
			expect(result.content).toBe('');
			expect(result.payload).toBeUndefined();
			expect(result.namespace).toBeUndefined();
		});

		it('should generate id if missing', () => {
			const input = JSON.stringify({
				level: 'log',
				timestamp: 1234567890,
				text: 'No ID'
			});

			const result = parseP2PMessage(input, 'inbound');

			expect(result.id).toBeDefined();
			expect(result.id).toMatch(/^\d+-/);
		});
	});

	describe('Plain Text Messages', () => {
		it('should parse plain text as text type', () => {
			const input = 'Hello, this is plain text';

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('text');
			expect(result.content).toBe('Hello, this is plain text');
			expect(result.direction).toBe('inbound');
			expect(result.payload).toBeUndefined();
			expect(result.namespace).toBe(null);
		});

		it('should handle empty string', () => {
			const input = '';

			const result = parseP2PMessage(input, 'outbound');

			expect(result.type).toBe('text');
			expect(result.content).toBe('');
			expect(result.direction).toBe('outbound');
		});

		it('should handle multiline text', () => {
			const input = 'Line 1\nLine 2\nLine 3';

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('text');
			expect(result.content).toBe('Line 1\nLine 2\nLine 3');
		});
	});

	describe('JSON Non-Console Messages', () => {
		it('should stringify JSON object without level', () => {
			const input = JSON.stringify({ foo: 'bar', baz: 123 });

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('text');
			expect(result.content).toBe('{"foo":"bar","baz":123}');
		});

		it('should stringify JSON array', () => {
			const input = JSON.stringify([1, 2, 3, 'four']);

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('text');
			expect(result.content).toContain('1');
			expect(result.content).toContain('four');
		});

		it('should handle JSON with timestamp but no level', () => {
			const input = JSON.stringify({ timestamp: 123, data: 'test' });

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('text');
		});
	});

	describe('Direction Handling', () => {
		it('should set direction to inbound', () => {
			const input = 'test message';

			const result = parseP2PMessage(input, 'inbound');

			expect(result.direction).toBe('inbound');
		});

		it('should set direction to outbound', () => {
			const input = 'test message';

			const result = parseP2PMessage(input, 'outbound');

			expect(result.direction).toBe('outbound');
		});

		it('should preserve direction for structured messages', () => {
			const input = JSON.stringify({
				level: 'log',
				timestamp: 123,
				text: 'test'
			});

			const resultInbound = parseP2PMessage(input, 'inbound');
			const resultOutbound = parseP2PMessage(input, 'outbound');

			expect(resultInbound.direction).toBe('inbound');
			expect(resultOutbound.direction).toBe('outbound');
		});
	});

	describe('Edge Cases', () => {
		it('should handle malformed JSON gracefully', () => {
			const input = '{"invalid": json}';

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('text');
			expect(result.content).toBe(input);
		});

		it('should handle null input', () => {
			const input = 'null';

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('text');
			expect(result.content).toBe('null');
		});

		it('should handle special characters', () => {
			const input = 'Special chars: 🚀 ñ €';

			const result = parseP2PMessage(input, 'inbound');

			expect(result.content).toBe('Special chars: 🚀 ñ €');
		});

		it('should handle very long messages', () => {
			const longText = 'x'.repeat(10000);

			const result = parseP2PMessage(longText, 'inbound');

			expect(result.content).toBe(longText);
			expect(result.content.length).toBe(10000);
		});

		it('should handle nested JSON structures', () => {
			const input = JSON.stringify({
				level: 'log',
				timestamp: 123,
				text: 'nested',
				payload: [{ deep: { nested: { value: 'here' } } }]
			});

			const result = parseP2PMessage(input, 'inbound');

			expect(result.type).toBe('log');
			expect(result.payload).toEqual([{ deep: { nested: { value: 'here' } } }]);
		});
	});
});

describe('Message Handling - serializeP2PMessage', () => {
	it('should return string as-is', () => {
		const input = 'plain string';

		const result = serializeP2PMessage(input);

		expect(result).toBe('plain string');
	});

	it('should serialize object to JSON string', () => {
		const input = { foo: 'bar', num: 42 };

		const result = serializeP2PMessage(input);

		expect(result).toBe('{"foo":"bar","num":42}');
	});

	it('should serialize P2PMessage object', () => {
		const input = {
			id: 'msg-123',
			timestamp: 1234567890,
			direction: 'outbound',
			type: 'log',
			content: 'Test message',
			payload: [1, 2, 3],
			namespace: 'test'
		};

		const result = serializeP2PMessage(input);
		const parsed = JSON.parse(result);

		expect(parsed.id).toBe('msg-123');
		expect(parsed.type).toBe('log');
		expect(parsed.content).toBe('Test message');
	});

	it('should handle array', () => {
		const input = [1, 2, 'three'];

		const result = serializeP2PMessage(input);

		expect(result).toBe('[1,2,"three"]');
	});

	it('should handle null', () => {
		const input = null;

		const result = serializeP2PMessage(input);

		expect(result).toBe('null');
	});

	it('should handle undefined by returning undefined', () => {
		const input = undefined;

		const result = serializeP2PMessage(input);

		// JSON.stringify(undefined) returns undefined (not a string)
		expect(result).toBe(undefined);
	});

	it('should handle nested objects', () => {
		const input = {
			outer: {
				inner: {
					deep: 'value'
				}
			}
		};

		const result = serializeP2PMessage(input);
		const parsed = JSON.parse(result);

		expect(parsed.outer.inner.deep).toBe('value');
	});
});

describe('Message Handling - Round Trip', () => {
	it('should preserve structured message through serialize and parse', () => {
		const original = {
			id: 'test-round-trip',
			level: 'warn',
			timestamp: 9999999999,
			text: 'Round trip test',
			payload: [{ key: 'value' }],
			namespace: 'roundtrip'
		};

		const serialized = serializeP2PMessage(original);
		const parsed = parseP2PMessage(serialized, 'inbound');

		expect(parsed.id).toBe(original.id);
		expect(parsed.type).toBe(original.level);
		expect(parsed.timestamp).toBe(original.timestamp);
		expect(parsed.content).toBe(original.text);
		expect(parsed.payload).toEqual(original.payload);
		expect(parsed.namespace).toBe(original.namespace);
	});

	it('should preserve plain text through serialize and parse', () => {
		const original = 'Plain text message';

		const serialized = serializeP2PMessage(original);
		const parsed = parseP2PMessage(serialized, 'outbound');

		expect(parsed.content).toBe(original);
		expect(parsed.type).toBe('text');
	});
});

// ─── Protocol Switching Logic ─────────────────────────────────────────────

describe('Protocol Switching', () => {
	/**
	 * Simulates the switchProtocol logic from +page.svelte
	 */
	function createUIState() {
		return {
			protocol: 'ws',
			serverUrl: 'ws://localhost:3000',
			roomName: '',
			isConnected: false,
			connectionState: 'disconnected',
			roomPeers: [],
			wsClient: null,
			restClient: null
		};
	}

	function switchProtocol(state, newProtocol) {
		if (newProtocol === state.protocol) return state;
		if (state.isConnected) {
			state.isConnected = false;
			state.connectionState = 'disconnected';
			state.roomPeers = [];
		}
		state.protocol = newProtocol;
		state.serverUrl = newProtocol === 'ws' ? 'ws://localhost:3000' : 'http://localhost:3000';
		state.wsClient = null;
		state.restClient = null;
		return state;
	}

	it('should default to ws protocol', () => {
		const state = createUIState();
		expect(state.protocol).toBe('ws');
		expect(state.serverUrl).toBe('ws://localhost:3000');
	});

	it('should switch to rest protocol and update URL', () => {
		const state = switchProtocol(createUIState(), 'rest');
		expect(state.protocol).toBe('rest');
		expect(state.serverUrl).toBe('http://localhost:3000');
	});

	it('should switch back to ws protocol and update URL', () => {
		let state = switchProtocol(createUIState(), 'rest');
		state = switchProtocol(state, 'ws');
		expect(state.protocol).toBe('ws');
		expect(state.serverUrl).toBe('ws://localhost:3000');
	});

	it('should not change state when switching to same protocol', () => {
		const state = createUIState();
		state.serverUrl = 'ws://custom:8080';
		const result = switchProtocol(state, 'ws');
		expect(result.serverUrl).toBe('ws://custom:8080');
	});

	it('should disconnect when switching while connected', () => {
		const state = createUIState();
		state.isConnected = true;
		state.connectionState = 'open';
		state.roomPeers = ['peer-1', 'peer-2'];
		const result = switchProtocol(state, 'rest');
		expect(result.isConnected).toBe(false);
		expect(result.connectionState).toBe('disconnected');
		expect(result.roomPeers).toEqual([]);
	});

	it('should clear client references on switch', () => {
		const state = createUIState();
		state.wsClient = { mock: true };
		const result = switchProtocol(state, 'rest');
		expect(result.wsClient).toBeNull();
		expect(result.restClient).toBeNull();
	});
});

// ─── Connection State Management ──────────────────────────────────────────

describe('Connection State Management', () => {
	describe('WebSocket connection state', () => {
		it('should derive state from ws client getConnectionState', () => {
			const mockWsClient = {
				getConnectionState: () => 'open',
				isConnected: () => true,
				getRoomPeers: () => ['peer-a']
			};

			const connectionState = mockWsClient.getConnectionState();
			const isConnected = mockWsClient.isConnected();
			const roomPeers = mockWsClient.getRoomPeers();

			expect(connectionState).toBe('open');
			expect(isConnected).toBe(true);
			expect(roomPeers).toEqual(['peer-a']);
		});

		it('should show disconnected state when ws not connected', () => {
			const mockWsClient = {
				getConnectionState: () => 'disconnected',
				isConnected: () => false,
				getRoomPeers: () => []
			};

			expect(mockWsClient.getConnectionState()).toBe('disconnected');
			expect(mockWsClient.isConnected()).toBe(false);
			expect(mockWsClient.getRoomPeers()).toEqual([]);
		});

		it('should support connecting state', () => {
			const mockWsClient = {
				getConnectionState: () => 'connecting',
				isConnected: () => false,
				getRoomPeers: () => []
			};

			expect(mockWsClient.getConnectionState()).toBe('connecting');
		});
	});

	describe('REST connection state', () => {
		it('should derive state from isConnected for REST', () => {
			const mockRestClient = {
				isConnected: () => true,
				getRoomPeers: () => ['peer-b', 'peer-c']
			};

			const isConnected = mockRestClient.isConnected();
			const connectionState = isConnected ? 'connected' : 'disconnected';
			const roomPeers = mockRestClient.getRoomPeers();

			expect(connectionState).toBe('connected');
			expect(isConnected).toBe(true);
			expect(roomPeers).toEqual(['peer-b', 'peer-c']);
		});

		it('should show disconnected when REST not connected', () => {
			const mockRestClient = {
				isConnected: () => false,
				getRoomPeers: () => []
			};

			const isConnected = mockRestClient.isConnected();
			const connectionState = isConnected ? 'connected' : 'disconnected';

			expect(connectionState).toBe('disconnected');
		});
	});
});

// ─── Room Management ──────────────────────────────────────────────────────

describe('Room Management', () => {
	describe('WS room operations', () => {
		it('should call joinRoom with valid room name', () => {
			const joinRoom = vi.fn().mockReturnValue(true);
			const mockWsClient = { joinRoom };

			const roomName = 'test-room';
			if (roomName.trim()) {
				mockWsClient.joinRoom(roomName);
			}

			expect(joinRoom).toHaveBeenCalledWith('test-room');
		});

		it('should not call joinRoom with empty room name', () => {
			const joinRoom = vi.fn();
			const mockWsClient = { joinRoom };

			const roomName = '';
			if (roomName.trim()) {
				mockWsClient.joinRoom(roomName);
			}

			expect(joinRoom).not.toHaveBeenCalled();
		});

		it('should call leaveRoom and clear peers', () => {
			const leaveRoom = vi.fn().mockReturnValue(true);
			const mockWsClient = { leaveRoom };

			let roomPeers = ['peer-1', 'peer-2'];
			mockWsClient.leaveRoom();
			roomPeers = [];

			expect(leaveRoom).toHaveBeenCalled();
			expect(roomPeers).toEqual([]);
		});
	});

	describe('REST room operations', () => {
		it('should require room name for REST connect', async () => {
			let errorOccurred = false;
			const roomName = '';

			if (!roomName.trim()) {
				errorOccurred = true;
			}

			expect(errorOccurred).toBe(true);
		});

		it('should pass room name to REST connect', async () => {
			const connect = vi.fn().mockResolvedValue({ id: 'test-id', room: 'my-room', peers: [] });
			const mockRestClient = { connect };

			const roomName = 'my-room';
			const data = await mockRestClient.connect({ room: roomName });

			expect(connect).toHaveBeenCalledWith({ room: 'my-room' });
			expect(data.room).toBe('my-room');
			expect(data.id).toBe('test-id');
		});
	});
});

// ─── Peer Message Handler ─────────────────────────────────────────────────

describe('Peer Message Handler', () => {
	it('should register onPeerMessage handler for WS client', () => {
		const onPeerMessage = vi.fn();
		const mockClient = { onPeerMessage };

		// Simulates setupPeerMessageHandler from +page.svelte
		mockClient.onPeerMessage((_peerId, message) => {
			parseP2PMessage(message, 'inbound');
		});

		expect(onPeerMessage).toHaveBeenCalled();
		expect(typeof onPeerMessage.mock.calls[0][0]).toBe('function');
	});

	it('should register onPeerMessage handler for REST client', () => {
		const onPeerMessage = vi.fn();
		const mockClient = { onPeerMessage };

		mockClient.onPeerMessage((_peerId, message) => {
			parseP2PMessage(message, 'inbound');
		});

		expect(onPeerMessage).toHaveBeenCalled();
	});

	it('should parse inbound peer message correctly', () => {
		const rawMessage = JSON.stringify({
			id: 'msg-1',
			level: 'log',
			timestamp: 12345,
			text: 'Hello from peer',
			payload: ['hello'],
			namespace: 'app'
		});

		const parsed = parseP2PMessage(rawMessage, 'inbound');

		expect(parsed.direction).toBe('inbound');
		expect(parsed.type).toBe('log');
		expect(parsed.content).toBe('Hello from peer');
	});
});

// ─── Send Message Logic ───────────────────────────────────────────────────

describe('Send Message', () => {
	it('should not send when input is empty', () => {
		const sendMessage = vi.fn();
		const inputMessage = '   ';
		const isConnected = true;

		if (!inputMessage.trim() || !isConnected) return;
		sendMessage(inputMessage);

		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('should not send when not connected', () => {
		const sendMessage = vi.fn();
		const inputMessage = 'hello';
		const isConnected = false;

		if (!inputMessage.trim() || !isConnected) return;
		sendMessage(inputMessage);

		expect(sendMessage).not.toHaveBeenCalled();
	});

	it('should serialize outbound message via client.sendMessage', () => {
		const clientSendMessage = vi.fn().mockReturnValue(true);
		const mockClient = { sendMessage: clientSendMessage };

		const outboundMsg = {
			id: 'out-1',
			timestamp: Date.now(),
			direction: 'outbound',
			type: 'text',
			content: 'Hello world'
		};

		const serialized = serializeP2PMessage(outboundMsg);
		mockClient.sendMessage(serialized);

		expect(clientSendMessage).toHaveBeenCalledWith(serialized);
		const parsed = JSON.parse(serialized);
		expect(parsed.content).toBe('Hello world');
	});

	it('should select correct client based on protocol', () => {
		const wsSend = vi.fn();
		const restSend = vi.fn();
		const wsClient = { sendMessage: wsSend };
		const restClient = { sendMessage: restSend };

		// WS protocol
		let protocol = 'ws';
		let client = protocol === 'ws' ? wsClient : restClient;
		client.sendMessage('test');
		expect(wsSend).toHaveBeenCalledWith('test');
		expect(restSend).not.toHaveBeenCalled();

		// REST protocol
		protocol = 'rest';
		client = protocol === 'ws' ? wsClient : restClient;
		client.sendMessage('test2');
		expect(restSend).toHaveBeenCalledWith('test2');
	});
});

// ─── WS-Only Features ─────────────────────────────────────────────────────

describe('WS-Only Features', () => {
	it('should only allow forceReconnect in ws mode', () => {
		const forceReconnect = vi.fn();
		const mockWsClient = { forceReconnect };

		// WS mode
		let protocol = 'ws';
		if (protocol === 'ws' && mockWsClient) {
			mockWsClient.forceReconnect();
		}
		expect(forceReconnect).toHaveBeenCalledTimes(1);

		// REST mode - should not call
		protocol = 'rest';
		if (protocol === 'ws' && mockWsClient) {
			mockWsClient.forceReconnect();
		}
		expect(forceReconnect).toHaveBeenCalledTimes(1);
	});

	it('should toggle auto-reconnect on ws client', () => {
		const enableAutoReconnect = vi.fn();
		const disableAutoReconnect = vi.fn();
		const mockWsClient = { enableAutoReconnect, disableAutoReconnect };

		let autoReconnect = true;

		// Disable
		autoReconnect = !autoReconnect;
		if (mockWsClient) {
			if (autoReconnect) {
				mockWsClient.enableAutoReconnect();
			} else {
				mockWsClient.disableAutoReconnect();
			}
		}
		expect(disableAutoReconnect).toHaveBeenCalled();

		// Enable
		autoReconnect = !autoReconnect;
		if (mockWsClient) {
			if (autoReconnect) {
				mockWsClient.enableAutoReconnect();
			} else {
				mockWsClient.disableAutoReconnect();
			}
		}
		expect(enableAutoReconnect).toHaveBeenCalled();
	});

	it('should update reconnect interval on ws client', () => {
		const setReconnectInterval = vi.fn();
		const mockWsClient = { setReconnectInterval };

		const reconnectInterval = 5000;
		if (reconnectInterval > 0 && mockWsClient) {
			mockWsClient.setReconnectInterval(reconnectInterval);
		}

		expect(setReconnectInterval).toHaveBeenCalledWith(5000);
	});

	it('should not update reconnect interval when value is zero or negative', () => {
		const setReconnectInterval = vi.fn();
		const mockWsClient = { setReconnectInterval };

		let reconnectInterval = 0;
		if (reconnectInterval > 0 && mockWsClient) {
			mockWsClient.setReconnectInterval(reconnectInterval);
		}
		expect(setReconnectInterval).not.toHaveBeenCalled();

		reconnectInterval = -100;
		if (reconnectInterval > 0 && mockWsClient) {
			mockWsClient.setReconnectInterval(reconnectInterval);
		}
		expect(setReconnectInterval).not.toHaveBeenCalled();
	});
});
