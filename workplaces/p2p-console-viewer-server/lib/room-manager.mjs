import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory room and client state manager for the REST-based signaling API.
 *
 * Clients call POST /api/join to register, then poll GET /api/poll for
 * inbound messages and POST /api/signal to forward signaling payloads.
 *
 * NOTE: This implementation keeps all state in process-local memory.
 * When each Vercel serverless function is a separate isolated process the
 * handlers will NOT share a single instance.  For multi-instance production
 * deployments replace `lib/shared-state.js` with a Vercel KV (Redis) backed
 * adapter that implements the same interface.
 */
class RoomManager {
	constructor() {
		/**
		 * @type {Map<string, {
		 *   id: string,
		 *   room: string|null,
		 *   messageQueue: object[],
		 *   lastSeen: number,
		 *   rate: { tokens: number, last: number }
		 * }>}
		 */
		this.clients = new Map();

		/** @type {Map<string, Set<string>>} */
		this.rooms = new Map();
	}

	// ─── Client lifecycle ──────────────────────────────────────────────────────

	/**
	 * Register a new anonymous client.
	 * @param {number} messageBurst - Initial token-bucket fill level.
	 * @returns {string} The newly assigned client id.
	 */
	createClient(messageBurst) {
		const id = uuidv4();
		this.clients.set(id, {
			id,
			room: null,
			messageQueue: [],
			lastSeen: Date.now(),
			rate: { tokens: messageBurst, last: Date.now() }
		});
		return id;
	}

	/**
	 * Unregister a client, leaving its room first when necessary.
	 * @param {string} id
	 * @returns {{ id: string, room: string|null }|null} Removed entry, or null.
	 */
	removeClient(id) {
		const client = this.clients.get(id);
		if (!client) {
			return null;
		}
		if (client.room) {
			this._leaveRoom(id, client);
		}
		this.clients.delete(id);
		return client;
	}

	/**
	 * @param {string} id
	 * @returns {object|undefined}
	 */
	getClient(id) {
		return this.clients.get(id);
	}

	/**
	 * Refresh the lastSeen timestamp so the client is not evicted.
	 * @param {string} id
	 */
	touch(id) {
		const client = this.clients.get(id);
		if (client) {
			client.lastSeen = Date.now();
		}
	}

	// ─── Room management ───────────────────────────────────────────────────────

	/**
	 * Add a client to a room, leaving any previous room first.
	 * Queues a `peer-joined` notification to every existing member.
	 *
	 * @param {string} clientId
	 * @param {string} roomName
	 * @param {number} maxRoomClients
	 * @returns {{ room: string, peers: string[] }|{ error: string }}
	 */
	joinRoom(clientId, roomName, maxRoomClients) {
		const client = this.clients.get(clientId);
		if (!client) {
			return { error: 'client-not-found' };
		}

		if (client.room) {
			this._leaveRoom(clientId, client);
		}

		const room = this.rooms.get(roomName);
		if (room && room.size >= maxRoomClients) {
			return { error: 'room-full' };
		}

		client.room = roomName;
		if (!this.rooms.has(roomName)) {
			this.rooms.set(roomName, new Set());
		}
		this.rooms.get(roomName).add(clientId);

		const peers = Array.from(this.rooms.get(roomName)).filter((id) => id !== clientId);

		// Notify existing peers about the newcomer.
		for (const peerId of peers) {
			this._enqueue(peerId, { type: 'peer-joined', peerId: clientId });
		}

		return { room: roomName, peers };
	}

	/**
	 * Remove a client from its current room.
	 * Queues a `peer-left` notification to every remaining member.
	 *
	 * @param {string} clientId
	 * @returns {{ roomName: string }|{ error: string }}
	 */
	leaveRoom(clientId) {
		const client = this.clients.get(clientId);
		if (!client || !client.room) {
			return { error: 'not-in-room' };
		}
		return this._leaveRoom(clientId, client);
	}

	/** @private */
	_leaveRoom(clientId, client) {
		const roomName = client.room;
		const room = this.rooms.get(roomName);
		if (room) {
			room.delete(clientId);
			for (const peerId of room) {
				this._enqueue(peerId, { type: 'peer-left', peerId: clientId });
			}
			if (room.size === 0) {
				this.rooms.delete(roomName);
			}
		}
		client.room = null;
		return { roomName };
	}

	// ─── Signaling ─────────────────────────────────────────────────────────────

	/**
	 * Route a signaling message from `fromId` to one peer (`message.to`) or
	 * broadcast to all other members of the sender's room.
	 *
	 * @param {string} fromId
	 * @param {object} message - Must include `type`.  Optional `to` for unicast.
	 * @param {number} maxQueueSize
	 * @returns {{ ok: true }|{ error: string }}
	 */
	routeSignal(fromId, message, maxQueueSize) {
		const sender = this.clients.get(fromId);
		if (!sender) {
			return { error: 'client-not-found' };
		}

		const toId = message.to ? String(message.to) : null;

		if (toId) {
			const target = this.clients.get(toId);
			if (!target) {
				return { error: 'target-not-found' };
			}
			if (!sender.room) {
				return { error: 'not-in-room' };
			}
			if (target.room !== sender.room) {
				return { error: 'target-in-different-room' };
			}
			if (target.messageQueue.length >= maxQueueSize) {
				return { error: 'queue-full' };
			}
			this._enqueue(toId, Object.assign({}, message, { from: fromId }));
		} else {
			if (!sender.room) {
				return { error: 'not-in-room' };
			}
			const room = this.rooms.get(sender.room);
			if (room) {
				for (const peerId of room) {
					if (peerId === fromId) {
						continue;
					}
					const peer = this.clients.get(peerId);
					if (peer && peer.messageQueue.length < maxQueueSize) {
						this._enqueue(peerId, Object.assign({}, message, { from: fromId }));
					}
				}
			}
		}

		return { ok: true };
	}

	// ─── Polling ───────────────────────────────────────────────────────────────

	/**
	 * Atomically drain and return all queued messages for a client.
	 * Also refreshes the client's lastSeen timestamp.
	 *
	 * @param {string} clientId
	 * @returns {object[]|null} Array of messages, or null when client not found.
	 */
	drainQueue(clientId) {
		const client = this.clients.get(clientId);
		if (!client) {
			return null;
		}
		const messages = client.messageQueue.splice(0);
		client.lastSeen = Date.now();
		return messages;
	}

	// ─── Housekeeping ──────────────────────────────────────────────────────────

	/**
	 * Remove clients that have not polled within `ttlMs` milliseconds.
	 * Should be called periodically (e.g. on each poll request).
	 *
	 * @param {number} ttlMs
	 */
	evictStale(ttlMs) {
		const now = Date.now();
		for (const [id, client] of this.clients.entries()) {
			if (now - client.lastSeen > ttlMs) {
				this.removeClient(id);
			}
		}
	}

	// ─── Observability ─────────────────────────────────────────────────────────

	/**
	 * Return the current number of connected clients.
	 * @returns {number}
	 */
	getClientCount() {
		return this.clients.size;
	}

	/**
	 * Return a point-in-time snapshot of connected clients and rooms.
	 * @returns {{ totalClients: number, clients: string[], rooms: object }}
	 */
	getStatus() {
		const roomsInfo = {};
		for (const [roomName, clientIds] of this.rooms.entries()) {
			roomsInfo[roomName] = Array.from(clientIds);
		}
		return {
			totalClients: this.clients.size,
			clients: Array.from(this.clients.keys()),
			rooms: roomsInfo
		};
	}

	// ─── Private helpers ───────────────────────────────────────────────────────

	/** @private */
	_enqueue(clientId, message) {
		const client = this.clients.get(clientId);
		if (client) {
			client.messageQueue.push(message);
		}
	}
}

export { RoomManager };
