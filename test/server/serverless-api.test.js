import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { RoomManager } = require('../../workplaces/p2p-console-viewer-server/lib/room-manager.js');
const { createJoinHandler } = require('../../workplaces/p2p-console-viewer-server/api/join.js');
const { createLeaveHandler } = require('../../workplaces/p2p-console-viewer-server/api/leave.js');
const { createSignalHandler } = require('../../workplaces/p2p-console-viewer-server/api/signal.js');
const { createPollHandler } = require('../../workplaces/p2p-console-viewer-server/api/poll.js');
const { createStatusHandler } = require('../../workplaces/p2p-console-viewer-server/api/status.js');

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Minimal Express-like request stub */
function req(method, { body = {}, query = {} } = {}) {
	return { method, body, query, socket: { remoteAddress: '127.0.0.1' } };
}

/** Captures status + json body */
function res() {
	const r = {
		_status: 200,
		_body: null,
		status(code) {
			this._status = code;
			return this;
		},
		json(body) {
			this._body = body;
		}
	};
	return r;
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
	it('rejects non-POST requests with 405', () => {
		const r = res();
		join(req('GET'), r);
		expect(r._status).toBe(405);
		expect(r._body.error).toBe('method-not-allowed');
	});

	it('rejects missing room with 400', () => {
		const r = res();
		join(req('POST', { body: {} }), r);
		expect(r._status).toBe(400);
		expect(r._body.error).toBe('invalid-room-name');
	});

	it('rejects an invalid room name with 400', () => {
		const r = res();
		join(req('POST', { body: { room: 'bad room!' } }), r);
		expect(r._status).toBe(400);
		expect(r._body.error).toBe('invalid-room-name');
	});

	it('returns id, room, and empty peers on first join', () => {
		const r = res();
		join(req('POST', { body: { room: 'my-room' } }), r);
		expect(r._status).toBe(200);
		expect(typeof r._body.id).toBe('string');
		expect(r._body.room).toBe('my-room');
		expect(r._body.peers).toEqual([]);
	});

	it('returns existing peers when a second client joins', () => {
		const r1 = res();
		join(req('POST', { body: { room: 'shared' } }), r1);
		const firstId = r1._body.id;

		const r2 = res();
		join(req('POST', { body: { room: 'shared' } }), r2);
		expect(r2._body.peers).toContain(firstId);
	});

	it('rejects when room is full (maxRoomClients = 50 default)', () => {
		// Fill the room to capacity by bypassing the handler
		const roomName = 'full-room';
		for (let i = 0; i < 50; i++) {
			const id = rm.createClient(20);
			rm.joinRoom(id, roomName, 50);
		}
		const r = res();
		join(req('POST', { body: { room: roomName } }), r);
		expect(r._status).toBe(409);
		expect(r._body.error).toBe('room-full');
	});
});

// ── POST /api/leave ───────────────────────────────────────────────────────────

describe('POST /api/leave', () => {
	it('rejects non-POST requests with 405', () => {
		const r = res();
		leave(req('GET'), r);
		expect(r._status).toBe(405);
	});

	it('rejects a missing id with 400', () => {
		const r = res();
		leave(req('POST', { body: {} }), r);
		expect(r._status).toBe(400);
		expect(r._body.error).toBe('invalid-id');
	});

	it('returns ok: true even for an unknown id (idempotent)', () => {
		const r = res();
		leave(req('POST', { body: { id: 'no-such-client' } }), r);
		expect(r._status).toBe(200);
		expect(r._body.ok).toBe(true);
	});

	it('removes a known client', () => {
		const joinRes = res();
		join(req('POST', { body: { room: 'room' } }), joinRes);
		const { id } = joinRes._body;

		const r = res();
		leave(req('POST', { body: { id } }), r);
		expect(r._status).toBe(200);
		expect(rm.getClient(id)).toBeUndefined();
	});
});

// ── POST /api/signal ──────────────────────────────────────────────────────────

describe('POST /api/signal', () => {
	it('rejects non-POST requests with 405', () => {
		const r = res();
		signal(req('GET'), r);
		expect(r._status).toBe(405);
	});

	it('rejects prototype-pollution payload with 400', () => {
		const body = Object.create(null);
		body.__proto__ = {};
		body.id = 'x';
		body.type = 'offer';
		// Use hasOwnProperty to simulate the attack surface
		const malicious = JSON.parse('{"__proto__":{},"id":"x","type":"offer"}');
		const r = res();
		signal(req('POST', { body: malicious }), r);
		expect(r._status).toBe(400);
	});

	it('rejects missing id with 400', () => {
		const r = res();
		signal(req('POST', { body: { type: 'offer' } }), r);
		expect(r._status).toBe(400);
		expect(r._body.error).toBe('invalid-id');
	});

	it('rejects missing type with 400', () => {
		const r = res();
		signal(req('POST', { body: { id: 'x' } }), r);
		expect(r._status).toBe(400);
		expect(r._body.error).toBe('invalid-message');
	});

	it('returns 404 for unknown sender', () => {
		const r = res();
		signal(req('POST', { body: { id: 'ghost', type: 'offer' } }), r);
		expect(r._status).toBe(404);
	});

	it('queues a unicast message for the target', () => {
		const r1 = res();
		join(req('POST', { body: { room: 'r' } }), r1);
		const sender = r1._body.id;

		const r2 = res();
		join(req('POST', { body: { room: 'r' } }), r2);
		const target = r2._body.id;

		const r = res();
		signal(req('POST', { body: { id: sender, type: 'offer', to: target, sdp: 'test' } }), r);
		expect(r._status).toBe(200);
		expect(r._body.ok).toBe(true);

		const msgs = rm.drainQueue(target);
		expect(msgs.some((m) => m.type === 'offer' && m.from === sender)).toBe(true);
	});

	it('broadcasts when no target is specified', () => {
		const r1 = res();
		join(req('POST', { body: { room: 'r' } }), r1);
		const sender = r1._body.id;

		const r2 = res();
		join(req('POST', { body: { room: 'r' } }), r2);
		const other = r2._body.id;

		rm.drainQueue(other); // clear peer-joined noise

		signal(req('POST', { body: { id: sender, type: 'announce' } }), res());
		expect(rm.drainQueue(other).some((m) => m.type === 'announce')).toBe(true);
	});

	it('returns 400 when routing to a different room', () => {
		const r1 = res();
		join(req('POST', { body: { room: 'room-1' } }), r1);
		const sender = r1._body.id;

		const r2 = res();
		join(req('POST', { body: { room: 'room-2' } }), r2);
		const target = r2._body.id;

		const r = res();
		signal(req('POST', { body: { id: sender, type: 'offer', to: target } }), r);
		expect(r._status).toBe(400);
		expect(r._body.error).toBe('target-in-different-room');
	});

	it('returns 429 when the client exceeds the rate limit', () => {
		const joinRes = res();
		join(req('POST', { body: { room: 'r' } }), joinRes);
		const { id } = joinRes._body;

		// Exhaust all burst tokens
		const client = rm.getClient(id);
		client.rate.tokens = 0;
		client.rate.last = Date.now();

		const r = res();
		signal(req('POST', { body: { id, type: 'ping' } }), r);
		expect(r._status).toBe(429);
		expect(r._body.error).toBe('rate-limit');
	});
});

// ── GET /api/poll ─────────────────────────────────────────────────────────────

describe('GET /api/poll', () => {
	it('rejects non-GET requests with 405', () => {
		const r = res();
		poll(req('POST'), r);
		expect(r._status).toBe(405);
	});

	it('rejects missing id with 400', () => {
		const r = res();
		poll(req('GET', { query: {} }), r);
		expect(r._status).toBe(400);
		expect(r._body.error).toBe('invalid-id');
	});

	it('returns 404 for unknown client', () => {
		const r = res();
		poll(req('GET', { query: { id: 'ghost' } }), r);
		expect(r._status).toBe(404);
	});

	it('returns an empty message array for a fresh client', () => {
		const joinRes = res();
		join(req('POST', { body: { room: 'r' } }), joinRes);
		const { id } = joinRes._body;

		// Drain the initial peer-joined / room-state messages, then poll again
		rm.drainQueue(id);

		const r = res();
		poll(req('GET', { query: { id } }), r);
		expect(r._status).toBe(200);
		expect(r._body.messages).toEqual([]);
	});

	it('delivers queued messages and clears the queue', () => {
		const r1 = res();
		join(req('POST', { body: { room: 'r' } }), r1);
		const sender = r1._body.id;

		const r2 = res();
		join(req('POST', { body: { room: 'r' } }), r2);
		const receiver = r2._body.id;

		rm.drainQueue(receiver); // clear peer-joined

		signal(req('POST', { body: { id: sender, type: 'ping', to: receiver } }), res());

		const r = res();
		poll(req('GET', { query: { id: receiver } }), r);
		expect(r._body.messages.length).toBe(1);
		expect(r._body.messages[0].type).toBe('ping');

		// Second poll – queue should be empty
		const r3 = res();
		poll(req('GET', { query: { id: receiver } }), r3);
		expect(r3._body.messages).toEqual([]);
	});

	it('evicts stale clients during a poll', () => {
		// Register a client and mark it as stale
		const staleId = rm.createClient(20);
		rm.getClient(staleId).lastSeen = 0;

		// Register a live client and poll
		const joinRes = res();
		join(req('POST', { body: { room: 'r' } }), joinRes);
		const liveId = joinRes._body.id;

		poll(req('GET', { query: { id: liveId } }), res());

		expect(rm.getClient(staleId)).toBeUndefined();
		expect(rm.getClient(liveId)).toBeDefined();
	});
});

// ── GET /api/status ───────────────────────────────────────────────────────────

describe('GET /api/status', () => {
	it('rejects non-GET requests with 405', () => {
		const r = res();
		status(req('POST'), r);
		expect(r._status).toBe(405);
	});

	it('returns zero counts when no clients are connected', () => {
		const r = res();
		status(req('GET'), r);
		expect(r._status).toBe(200);
		expect(r._body.totalClients).toBe(0);
		expect(r._body.clients).toEqual([]);
		expect(r._body.rooms).toEqual({});
	});

	it('reflects current clients and rooms', () => {
		const r1 = res();
		join(req('POST', { body: { room: 'lobby' } }), r1);
		const r2 = res();
		join(req('POST', { body: { room: 'lobby' } }), r2);

		const r = res();
		status(req('GET'), r);
		expect(r._body.totalClients).toBe(2);
		expect(r._body.rooms['lobby']).toHaveLength(2);
	});
});
