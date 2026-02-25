import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { RoomManager } = require('../../workplaces/p2p-console-viewer-server/lib/room-manager.js');

describe('RoomManager', () => {
	let rm;

	beforeEach(() => {
		rm = new RoomManager();
	});

	// ── createClient ────────────────────────────────────────────────────────────

	describe('createClient', () => {
		it('assigns a unique id and stores the client', () => {
			const id = rm.createClient(20);
			expect(typeof id).toBe('string');
			expect(id.length).toBeGreaterThan(0);
			expect(rm.getClient(id)).toBeDefined();
		});

		it('initialises the client with no room and an empty queue', () => {
			const id = rm.createClient(20);
			const client = rm.getClient(id);
			expect(client.room).toBeNull();
			expect(client.messageQueue).toEqual([]);
		});

		it('seeds the rate bucket with the supplied burst value', () => {
			const id = rm.createClient(15);
			expect(rm.getClient(id).rate.tokens).toBe(15);
		});

		it('generates distinct ids for successive calls', () => {
			const ids = new Set(Array.from({ length: 100 }, () => rm.createClient(20)));
			expect(ids.size).toBe(100);
		});
	});

	// ── removeClient ────────────────────────────────────────────────────────────

	describe('removeClient', () => {
		it('returns null for an unknown id', () => {
			expect(rm.removeClient('no-such-id')).toBeNull();
		});

		it('removes the client from the map', () => {
			const id = rm.createClient(20);
			rm.removeClient(id);
			expect(rm.getClient(id)).toBeUndefined();
		});

		it('leaves the room and notifies peers when removed mid-room', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.joinRoom(b, 'room', 50);

			rm.removeClient(a);

			// b should have received peer-left
			const msgs = rm.drainQueue(b);
			expect(msgs.some((m) => m.type === 'peer-left' && m.peerId === a)).toBe(true);
			// room should still exist with only b
			expect(rm.rooms.get('room').has(a)).toBe(false);
		});

		it('deletes an empty room when the last client is removed', () => {
			const id = rm.createClient(20);
			rm.joinRoom(id, 'solo', 50);
			rm.removeClient(id);
			expect(rm.rooms.has('solo')).toBe(false);
		});
	});

	// ── touch ───────────────────────────────────────────────────────────────────

	describe('touch', () => {
		it('updates lastSeen', () => {
			const id = rm.createClient(20);
			const before = rm.getClient(id).lastSeen;
			// force a small delay so timestamps differ
			rm.getClient(id).lastSeen = 0;
			rm.touch(id);
			expect(rm.getClient(id).lastSeen).toBeGreaterThan(before - 1);
		});

		it('is a no-op for an unknown id', () => {
			expect(() => rm.touch('ghost')).not.toThrow();
		});
	});

	// ── joinRoom ────────────────────────────────────────────────────────────────

	describe('joinRoom', () => {
		it('returns an error for an unknown client', () => {
			expect(rm.joinRoom('ghost', 'room', 50)).toEqual({ error: 'client-not-found' });
		});

		it('returns room name and empty peers list when first to join', () => {
			const id = rm.createClient(20);
			const result = rm.joinRoom(id, 'room', 50);
			expect(result).toEqual({ room: 'room', peers: [] });
		});

		it('returns existing peers and queues peer-joined for them', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			const result = rm.joinRoom(b, 'room', 50);

			expect(result.peers).toContain(a);
			const msgs = rm.drainQueue(a);
			expect(msgs.some((m) => m.type === 'peer-joined' && m.peerId === b)).toBe(true);
		});

		it('returns room-full error when capacity is exceeded', () => {
			const first = rm.createClient(20);
			rm.joinRoom(first, 'room', 1);
			const second = rm.createClient(20);
			expect(rm.joinRoom(second, 'room', 1)).toEqual({ error: 'room-full' });
		});

		it('auto-leaves the previous room before joining a new one', () => {
			const id = rm.createClient(20);
			rm.joinRoom(id, 'room-1', 50);
			rm.joinRoom(id, 'room-2', 50);

			expect(rm.getClient(id).room).toBe('room-2');
			expect(rm.rooms.has('room-1')).toBe(false);
		});
	});

	// ── leaveRoom ───────────────────────────────────────────────────────────────

	describe('leaveRoom', () => {
		it('returns an error when the client is not in a room', () => {
			const id = rm.createClient(20);
			expect(rm.leaveRoom(id)).toEqual({ error: 'not-in-room' });
		});

		it('returns an error for an unknown client', () => {
			expect(rm.leaveRoom('ghost')).toEqual({ error: 'not-in-room' });
		});

		it('clears the room field on the client', () => {
			const id = rm.createClient(20);
			rm.joinRoom(id, 'room', 50);
			rm.leaveRoom(id);
			expect(rm.getClient(id).room).toBeNull();
		});

		it('queues peer-left for remaining members', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.joinRoom(b, 'room', 50);
			rm.drainQueue(a); // discard peer-joined noise

			rm.leaveRoom(b);
			const msgs = rm.drainQueue(a);
			expect(msgs.some((m) => m.type === 'peer-left' && m.peerId === b)).toBe(true);
		});

		it('deletes the room when empty', () => {
			const id = rm.createClient(20);
			rm.joinRoom(id, 'room', 50);
			rm.leaveRoom(id);
			expect(rm.rooms.has('room')).toBe(false);
		});
	});

	// ── routeSignal ─────────────────────────────────────────────────────────────

	describe('routeSignal', () => {
		it('returns client-not-found for unknown sender', () => {
			expect(rm.routeSignal('ghost', { type: 'offer' }, 100)).toEqual({
				error: 'client-not-found'
			});
		});

		it('returns not-in-room when sender has no room (broadcast)', () => {
			const id = rm.createClient(20);
			expect(rm.routeSignal(id, { type: 'offer' }, 100)).toEqual({
				error: 'not-in-room'
			});
		});

		it('unicasts to the target and appends from field', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.joinRoom(b, 'room', 50);
			rm.drainQueue(b); // discard peer-joined

			const result = rm.routeSignal(a, { type: 'offer', to: b, sdp: 'x' }, 100);
			expect(result).toEqual({ ok: true });

			const msgs = rm.drainQueue(b);
			expect(msgs).toHaveLength(1);
			expect(msgs[0]).toMatchObject({ type: 'offer', from: a, sdp: 'x' });
		});

		it('broadcasts to all other room members', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			const c = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.joinRoom(b, 'room', 50);
			rm.joinRoom(c, 'room', 50);
			rm.drainQueue(b);
			rm.drainQueue(c);

			rm.routeSignal(a, { type: 'announce' }, 100);

			expect(rm.drainQueue(b).some((m) => m.type === 'announce')).toBe(true);
			expect(rm.drainQueue(c).some((m) => m.type === 'announce')).toBe(true);
		});

		it('does not deliver the broadcast back to the sender', () => {
			const a = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.routeSignal(a, { type: 'announce' }, 100);
			expect(rm.drainQueue(a)).toEqual([]);
		});

		it('returns target-in-different-room for cross-room unicast', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room-1', 50);
			rm.joinRoom(b, 'room-2', 50);

			expect(rm.routeSignal(a, { type: 'offer', to: b }, 100)).toEqual({
				error: 'target-in-different-room',
			});
		});

		it('returns queue-full when target queue is at capacity', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.joinRoom(b, 'room', 50);

			// Fill target queue to capacity
			for (let i = 0; i < 2; i++) {
				rm.routeSignal(a, { type: 'ping', to: b }, 2);
			}
			expect(rm.routeSignal(a, { type: 'ping', to: b }, 2)).toEqual({
				error: 'queue-full'
			});
		});
	});

	// ── drainQueue ──────────────────────────────────────────────────────────────

	describe('drainQueue', () => {
		it('returns null for unknown client', () => {
			expect(rm.drainQueue('ghost')).toBeNull();
		});

		it('returns an empty array when there are no messages', () => {
			const id = rm.createClient(20);
			expect(rm.drainQueue(id)).toEqual([]);
		});

		it('empties the queue on drain', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.joinRoom(b, 'room', 50);

			rm.drainQueue(b); // first drain – returns peer-joined
			rm.routeSignal(a, { type: 'ping' }, 100);

			const first = rm.drainQueue(b);
			expect(first).toHaveLength(1);

			const second = rm.drainQueue(b);
			expect(second).toEqual([]);
		});
	});

	// ── evictStale ──────────────────────────────────────────────────────────────

	describe('evictStale', () => {
		it('removes clients that have not been seen within the TTL', () => {
			const id = rm.createClient(20);
			rm.getClient(id).lastSeen = Date.now() - 10000;
			rm.evictStale(5000);
			expect(rm.getClient(id)).toBeUndefined();
		});

		it('keeps clients that are still within the TTL', () => {
			const id = rm.createClient(20);
			rm.evictStale(60000);
			expect(rm.getClient(id)).toBeDefined();
		});

		it('cleans up rooms belonging to evicted clients', () => {
			const id = rm.createClient(20);
			rm.joinRoom(id, 'room', 50);
			rm.getClient(id).lastSeen = 0;
			rm.evictStale(1);
			expect(rm.rooms.has('room')).toBe(false);
		});
	});

	// ── getClientCount ─────────────────────────────────────────────────────────

	describe('getClientCount', () => {
		it('returns 0 when no clients are registered', () => {
			expect(rm.getClientCount()).toBe(0);
		});

		it('returns the correct count after adding clients', () => {
			rm.createClient(20);
			rm.createClient(20);
			rm.createClient(20);
			expect(rm.getClientCount()).toBe(3);
		});

		it('decrements after removing a client', () => {
			const a = rm.createClient(20);
			rm.createClient(20);
			expect(rm.getClientCount()).toBe(2);
			rm.removeClient(a);
			expect(rm.getClientCount()).toBe(1);
		});
	});

	// ── getStatus ───────────────────────────────────────────────────────────────

	describe('getStatus', () => {
		it('returns zero counts when empty', () => {
			expect(rm.getStatus()).toEqual({ totalClients: 0, clients: [], rooms: {} });
		});

		it('reflects current clients and rooms', () => {
			const a = rm.createClient(20);
			const b = rm.createClient(20);
			rm.joinRoom(a, 'room', 50);
			rm.joinRoom(b, 'room', 50);

			const status = rm.getStatus();
			expect(status.totalClients).toBe(2);
			expect(status.clients).toContain(a);
			expect(status.clients).toContain(b);
			expect(status.rooms['room']).toContain(a);
			expect(status.rooms['room']).toContain(b);
		});
	});
});
