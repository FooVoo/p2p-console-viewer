import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { RoomManager } = require('../../workplaces/p2p-console-viewer-server/lib/room-manager.js');
const { createJoinHandler } = require('../../workplaces/p2p-console-viewer-server/api/join.js');
const { createLeaveHandler } = require('../../workplaces/p2p-console-viewer-server/api/leave.js');
const { createSignalHandler } = require('../../workplaces/p2p-console-viewer-server/api/signal.js');
const { createPollHandler } = require('../../workplaces/p2p-console-viewer-server/api/poll.js');
const { createStatusHandler } = require('../../workplaces/p2p-console-viewer-server/api/status.js');
const { getCorsHeaders, withCors } = require('../../workplaces/p2p-console-viewer-server/lib/cors.js');

// ── Test helpers ─────────────────────────────────────────────────────────────

const BASE_URL = 'http://localhost';

/** Build a Web API Request for POST endpoints */
function postRequest(path, body = {}) {
	return new Request(`${BASE_URL}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

/** Build a Web API Request for GET endpoints (query params in URL) */
function getRequest(path, query = {}) {
	const url = new URL(path, BASE_URL);
	for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
	return new Request(url.toString(), { method: 'GET' });
}

// ── Shared setup ─────────────────────────────────────────────────────────────

let rm;
let join, leave, signal, poll, status;

beforeEach(() => {
	rm = new RoomManager();
	join = createJoinHandler(rm);
	leave = createLeaveHandler(rm);
	signal = createSignalHandler(rm);
	poll = createPollHandler(rm);
	status = createStatusHandler(rm);
});

// ── POST /api/join ────────────────────────────────────────────────────────────

describe('POST /api/join', () => {
	it('rejects non-POST requests with 405', async () => {
		const response = await join(new Request(`${BASE_URL}/api/join`, { method: 'GET' }));
		expect(response.status).toBe(405);
		expect((await response.json()).error).toBe('method-not-allowed');
	});

	it('rejects missing room with 400', async () => {
		const response = await join(postRequest('/api/join', {}));
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('invalid-room-name');
	});

	it('rejects an invalid room name with 400', async () => {
		const response = await join(postRequest('/api/join', { room: 'bad room!' }));
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('invalid-room-name');
	});

	it('returns id, room, and empty peers on first join', async () => {
		const response = await join(postRequest('/api/join', { room: 'my-room' }));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(typeof body.id).toBe('string');
		expect(body.room).toBe('my-room');
		expect(body.peers).toEqual([]);
	});

	it('returns existing peers when a second client joins', async () => {
		const r1 = await join(postRequest('/api/join', { room: 'shared' }));
		const firstId = (await r1.json()).id;

		const r2 = await join(postRequest('/api/join', { room: 'shared' }));
		expect((await r2.json()).peers).toContain(firstId);
	});

	it('rejects when room is full (maxRoomClients = 50 default)', async () => {
		// Fill the room to capacity by bypassing the handler
		const roomName = 'full-room';
		for (let i = 0; i < 50; i++) {
			const id = rm.createClient(20);
			rm.joinRoom(id, roomName, 50);
		}
		const response = await join(postRequest('/api/join', { room: roomName }));
		expect(response.status).toBe(409);
		expect((await response.json()).error).toBe('room-full');
	});
});

// ── POST /api/leave ───────────────────────────────────────────────────────────

describe('POST /api/leave', () => {
	it('rejects non-POST requests with 405', async () => {
		const response = await leave(new Request(`${BASE_URL}/api/leave`, { method: 'GET' }));
		expect(response.status).toBe(405);
	});

	it('rejects a missing id with 400', async () => {
		const response = await leave(postRequest('/api/leave', {}));
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('invalid-id');
	});

	it('returns ok: true even for an unknown id (idempotent)', async () => {
		const response = await leave(postRequest('/api/leave', { id: 'no-such-client' }));
		expect(response.status).toBe(200);
		expect((await response.json()).ok).toBe(true);
	});

	it('removes a known client', async () => {
		const joinResp = await join(postRequest('/api/join', { room: 'room' }));
		const { id } = await joinResp.json();

		const response = await leave(postRequest('/api/leave', { id }));
		expect(response.status).toBe(200);
		expect(rm.getClient(id)).toBeUndefined();
	});
});

// ── POST /api/signal ──────────────────────────────────────────────────────────

describe('POST /api/signal', () => {
	it('rejects non-POST requests with 405', async () => {
		const response = await signal(new Request(`${BASE_URL}/api/signal`, { method: 'GET' }));
		expect(response.status).toBe(405);
	});

	it('rejects prototype-pollution payload with 400', async () => {
		// Manually craft the raw body string to carry __proto__
		const request = new Request(`${BASE_URL}/api/signal`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"__proto__":{},"id":"x","type":"offer"}'
		});
		const response = await signal(request);
		expect(response.status).toBe(400);
	});

	it('rejects missing id with 400', async () => {
		const response = await signal(postRequest('/api/signal', { type: 'offer' }));
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('invalid-id');
	});

	it('rejects missing type with 400', async () => {
		const response = await signal(postRequest('/api/signal', { id: 'x' }));
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('invalid-message');
	});

	it('returns 404 for unknown sender', async () => {
		const response = await signal(postRequest('/api/signal', { id: 'ghost', type: 'offer' }));
		expect(response.status).toBe(404);
	});

	it('queues a unicast message for the target', async () => {
		const r1 = await join(postRequest('/api/join', { room: 'r' }));
		const sender = (await r1.json()).id;

		const r2 = await join(postRequest('/api/join', { room: 'r' }));
		const target = (await r2.json()).id;

		const response = await signal(
			postRequest('/api/signal', { id: sender, type: 'offer', to: target, sdp: 'test' })
		);
		expect(response.status).toBe(200);
		expect((await response.json()).ok).toBe(true);

		const msgs = rm.drainQueue(target);
		expect(msgs.some((m) => m.type === 'offer' && m.from === sender)).toBe(true);
	});

	it('broadcasts when no target is specified', async () => {
		const r1 = await join(postRequest('/api/join', { room: 'r' }));
		const sender = (await r1.json()).id;

		const r2 = await join(postRequest('/api/join', { room: 'r' }));
		const other = (await r2.json()).id;

		rm.drainQueue(other); // clear peer-joined noise

		await signal(postRequest('/api/signal', { id: sender, type: 'announce' }));
		expect(rm.drainQueue(other).some((m) => m.type === 'announce')).toBe(true);
	});

	it('returns 400 when routing to a different room', async () => {
		const r1 = await join(postRequest('/api/join', { room: 'room-1' }));
		const sender = (await r1.json()).id;

		const r2 = await join(postRequest('/api/join', { room: 'room-2' }));
		const target = (await r2.json()).id;

		const response = await signal(
			postRequest('/api/signal', { id: sender, type: 'offer', to: target })
		);
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('target-in-different-room');
	});

	it('returns 429 when the client exceeds the rate limit', async () => {
		const joinResp = await join(postRequest('/api/join', { room: 'r' }));
		const { id } = await joinResp.json();

		// Exhaust all burst tokens
		const client = rm.getClient(id);
		client.rate.tokens = 0;
		client.rate.last = Date.now();

		const response = await signal(postRequest('/api/signal', { id, type: 'ping' }));
		expect(response.status).toBe(429);
		expect((await response.json()).error).toBe('rate-limit');
	});
});

// ── GET /api/poll ─────────────────────────────────────────────────────────────

describe('GET /api/poll', () => {
	it('rejects non-GET requests with 405', async () => {
		const response = await poll(new Request(`${BASE_URL}/api/poll`, { method: 'POST' }));
		expect(response.status).toBe(405);
	});

	it('rejects missing id with 400', async () => {
		const response = await poll(getRequest('/api/poll', {}));
		expect(response.status).toBe(400);
		expect((await response.json()).error).toBe('invalid-id');
	});

	it('returns 404 for unknown client', async () => {
		const response = await poll(getRequest('/api/poll', { id: 'ghost' }));
		expect(response.status).toBe(404);
	});

	it('returns an empty message array for a fresh client', async () => {
		const joinResp = await join(postRequest('/api/join', { room: 'r' }));
		const { id } = await joinResp.json();

		// Drain the initial peer-joined / room-state messages, then poll again
		rm.drainQueue(id);

		const response = await poll(getRequest('/api/poll', { id }));
		expect(response.status).toBe(200);
		expect((await response.json()).messages).toEqual([]);
	});

	it('delivers queued messages and clears the queue', async () => {
		const r1 = await join(postRequest('/api/join', { room: 'r' }));
		const sender = (await r1.json()).id;

		const r2 = await join(postRequest('/api/join', { room: 'r' }));
		const receiver = (await r2.json()).id;

		rm.drainQueue(receiver); // clear peer-joined

		await signal(postRequest('/api/signal', { id: sender, type: 'ping', to: receiver }));

		const r = await poll(getRequest('/api/poll', { id: receiver }));
		const body = await r.json();
		expect(body.messages.length).toBe(1);
		expect(body.messages[0].type).toBe('ping');

		// Second poll – queue should be empty
		const r3 = await poll(getRequest('/api/poll', { id: receiver }));
		expect((await r3.json()).messages).toEqual([]);
	});

	it('evicts stale clients during a poll', async () => {
		// Register a client and mark it as stale
		const staleId = rm.createClient(20);
		rm.getClient(staleId).lastSeen = 0;

		// Register a live client and poll
		const joinResp = await join(postRequest('/api/join', { room: 'r' }));
		const liveId = (await joinResp.json()).id;

		await poll(getRequest('/api/poll', { id: liveId }));

		expect(rm.getClient(staleId)).toBeUndefined();
		expect(rm.getClient(liveId)).toBeDefined();
	});
});

// ── GET /api/status ───────────────────────────────────────────────────────────

describe('GET /api/status', () => {
	it('rejects non-GET requests with 405', async () => {
		const response = await status(new Request(`${BASE_URL}/api/status`, { method: 'POST' }));
		expect(response.status).toBe(405);
	});

	it('returns zero counts when no clients are connected', async () => {
		const response = await status(getRequest('/api/status'));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.totalClients).toBe(0);
		expect(body.clients).toEqual([]);
		expect(body.rooms).toEqual({});
	});

	it('reflects current clients and rooms', async () => {
		await join(postRequest('/api/join', { room: 'lobby' }));
		await join(postRequest('/api/join', { room: 'lobby' }));

		const response = await status(getRequest('/api/status'));
		const body = await response.json();
		expect(body.totalClients).toBe(2);
		expect(body.rooms['lobby']).toHaveLength(2);
	});
});

// ── Error handling ────────────────────────────────────────────────────────────

describe('Error handling (try/catch in handlers)', () => {
	it('join returns 500 when roomManager throws', async () => {
		const broken = {
			getClientCount: () => {
				throw new Error('boom');
			}
		};
		const handler = createJoinHandler(broken);
		const response = await handler(postRequest('/api/join', { room: 'room' }));
		expect(response.status).toBe(500);
		expect((await response.json()).error).toBe('internal-error');
	});

	it('leave returns 500 when roomManager throws', async () => {
		const broken = {
			removeClient: () => {
				throw new Error('boom');
			}
		};
		const handler = createLeaveHandler(broken);
		const response = await handler(postRequest('/api/leave', { id: 'x' }));
		expect(response.status).toBe(500);
		expect((await response.json()).error).toBe('internal-error');
	});

	it('poll returns 500 when roomManager throws', async () => {
		const broken = {
			evictStale: () => {
				throw new Error('boom');
			}
		};
		const handler = createPollHandler(broken);
		const response = await handler(getRequest('/api/poll', { id: 'x' }));
		expect(response.status).toBe(500);
		expect((await response.json()).error).toBe('internal-error');
	});

	it('signal returns 500 when roomManager throws', async () => {
		const broken = {
			getClient: () => {
				throw new Error('boom');
			}
		};
		const handler = createSignalHandler(broken);
		const response = await handler(postRequest('/api/signal', { id: 'x', type: 'offer' }));
		expect(response.status).toBe(500);
		expect((await response.json()).error).toBe('internal-error');
	});

	it('status returns 500 when roomManager throws', async () => {
		const broken = {
			getStatus: () => {
				throw new Error('boom');
			}
		};
		const handler = createStatusHandler(broken);
		const response = await handler(getRequest('/api/status'));
		expect(response.status).toBe(500);
		expect((await response.json()).error).toBe('internal-error');
	});
});

// ── CORS ──────────────────────────────────────────────────────────────────────

describe('getCorsHeaders', () => {
	it('returns wildcard when allowedOrigins is empty', () => {
		const req = new Request('http://localhost/api/status', {
			headers: { Origin: 'http://example.com' }
		});
		const headers = getCorsHeaders(req, []);
		expect(headers['Access-Control-Allow-Origin']).toBe('*');
	});

	it('reflects the origin when it is in the allowlist', () => {
		const req = new Request('http://localhost/api/status', {
			headers: { Origin: 'http://allowed.example.com' }
		});
		const headers = getCorsHeaders(req, ['http://allowed.example.com']);
		expect(headers['Access-Control-Allow-Origin']).toBe('http://allowed.example.com');
		expect(headers['Vary']).toBe('Origin');
	});

	it('returns no header when the origin is not in the allowlist', () => {
		const req = new Request('http://localhost/api/status', {
			headers: { Origin: 'http://other.com' }
		});
		const headers = getCorsHeaders(req, ['http://allowed.example.com']);
		expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
	});
});

describe('CORS headers on API responses', () => {
	it('join: adds Access-Control-Allow-Origin: * when allowedOrigins is empty', async () => {
		const handler = createJoinHandler(rm, []);
		const response = await handler(postRequest('/api/join', { room: 'cors-room' }));
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('join: reflects matching origin when allowedOrigins is set', async () => {
		const origin = 'http://trusted.example.com';
		const handler = createJoinHandler(rm, [origin]);
		const req = new Request('http://localhost/api/join', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: origin },
			body: JSON.stringify({ room: 'cors-room' })
		});
		const response = await handler(req);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
	});

	it('join: omits CORS header for disallowed origin', async () => {
		const handler = createJoinHandler(rm, ['http://trusted.example.com']);
		const req = new Request('http://localhost/api/join', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Origin: 'http://evil.com' },
			body: JSON.stringify({ room: 'cors-room' })
		});
		const response = await handler(req);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});

	it('join: OPTIONS preflight returns 204 with CORS headers', async () => {
		const origin = 'http://trusted.example.com';
		const handler = createJoinHandler(rm, [origin]);
		const req = new Request('http://localhost/api/join', {
			method: 'OPTIONS',
			headers: { Origin: origin }
		});
		const response = await handler(req);
		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
	});

	it('status: adds CORS headers', async () => {
		const handler = createStatusHandler(rm, []);
		const response = await handler(getRequest('/api/status'));
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('leave: adds CORS headers', async () => {
		const handler = createLeaveHandler(rm, []);
		const response = await handler(postRequest('/api/leave', { id: 'no-such-client' }));
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('signal: adds CORS headers', async () => {
		const handler = createSignalHandler(rm, []);
		const response = await handler(postRequest('/api/signal', { id: 'ghost', type: 'offer' }));
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('poll: adds CORS headers', async () => {
		const handler = createPollHandler(rm, []);
		const response = await handler(getRequest('/api/poll', { id: 'ghost' }));
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});
});
