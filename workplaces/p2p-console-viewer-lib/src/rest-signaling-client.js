// javascript
import { P2PConnection } from './p2p-connection.js';
import { RestClient } from './utils/rest-client.js';

/**
 * P2P signaling client that uses REST polling instead of WebSockets.
 *
 * Communicates with the serverless signaling API exposed by the server
 * variant (`POST /api/join`, `POST /api/leave`, `POST /api/signal`,
 * `GET /api/poll`).
 *
 * Responsibilities:
 * - Maintain a collection of P2P connections keyed by remote peer id.
 * - Poll for signaling messages and route them to the correct P2P connection.
 * - Forward local signaling events (offer/answer/ice candidates) via REST.
 *
 * Usage:
 * ```js
 * const client = new RestSignalingClient('https://example.com');
 * await client.connect({ room: 'my-room' });
 * await client.initiateP2P(remoteId);
 * // …
 * await client.disconnect();
 * ```
 */
export class RestSignalingClient {
	/**
	 * Create a REST-based signaling client.
	 *
	 * @param {string} baseUrl - Base URL of the signaling server (e.g. `https://example.com`).
	 * @param {Object} [options={}] - Optional configuration.
	 * @param {number} [options.pollIntervalMs=2000] - Milliseconds between poll requests.
	 * @param {number} [options.timeoutMs=10000] - Default request timeout.
	 */
	constructor(baseUrl, options = {}) {
		/**
		 * REST client used for HTTP requests.
		 * @type {RestClient}
		 */
		this.rest = new RestClient(baseUrl, {}, options.timeoutMs || 10000);

		/**
		 * Map of remotePeerId → P2PConnection instances.
		 * @type {Map<string, P2PConnection>}
		 */
		this.peers = new Map();

		/**
		 * The id assigned by the signaling server for this client.
		 * @type {string|null}
		 */
		this.currentServerID = null;

		/**
		 * The room this client is currently in.
		 * @type {string|null}
		 */
		this.currentRoom = null;

		/**
		 * List of peer IDs in the current room.
		 * @type {Array<string>}
		 */
		this.roomPeers = [];

		/**
		 * Milliseconds between poll requests.
		 * @type {number}
		 */
		this.pollIntervalMs = options.pollIntervalMs ?? 2000;

		/**
		 * Timer id for the poll loop (null when not polling).
		 * @type {ReturnType<typeof setTimeout>|null}
		 * @private
		 */
		this._pollTimer = null;

		/**
		 * Whether this client is currently connected (joined a room and polling).
		 * @type {boolean}
		 * @private
		 */
		this._connected = false;

		/**
		 * Error event handlers.
		 * @type {Array<function(Error):void>}
		 */
		this.onErrorHandlers = [];

		/**
		 * Peer error handlers.
		 * @type {Array<function(string, Error):void>}
		 */
		this.onPeerErrorHandlers = [];

		/**
		 * Handlers invoked when any connected peer sends an application-level
		 * message over the P2P data channel.
		 * @type {Array<function(string, string):void>}
		 */
		this.onPeerMessageHandlers = [];
	}

	// ─── Connection lifecycle ───────────────────────────────────────────────

	/**
	 * Join a room via the REST API and start polling for messages.
	 *
	 * @param {Object} opts
	 * @param {string} opts.room - Room name to join.
	 * @returns {Promise<{id: string, room: string, peers: string[]}>}
	 */
	async connect({ room } = {}) {
		if (!room || typeof room !== 'string' || room.trim() === '') {
			const error = new Error('Valid room name is required');
			this.emitError(error);
			throw error;
		}

		try {
			const data = await this.rest.post('/api/join', { room });
			this.currentServerID = data.id;
			this.currentRoom = data.room;
			this.roomPeers = data.peers || [];
			this._connected = true;
			this._startPolling();
			return data;
		} catch (error) {
			this.emitError(error);
			throw error;
		}
	}

	/**
	 * Leave the current room and stop polling.
	 *
	 * @returns {Promise<void>}
	 */
	async disconnect() {
		this._stopPolling();

		// Close all P2P connections
		for (const [id, p2p] of this.peers.entries()) {
			try {
				p2p.close();
			} catch (e) {
				console.warn('Error closing peer connection', id, e);
			}
		}
		this.peers.clear();

		if (this.currentServerID) {
			try {
				await this.rest.post('/api/leave', { id: this.currentServerID });
			} catch (e) {
				// Best-effort leave; ignore errors.
			}
		}

		this.currentServerID = null;
		this.currentRoom = null;
		this.roomPeers = [];
		this._connected = false;
	}

	// ─── Polling ────────────────────────────────────────────────────────────

	/**
	 * Start the periodic poll loop.
	 * @private
	 */
	_startPolling() {
		if (this._pollTimer !== null) {
			return;
		}
		this._schedulePoll();
	}

	/**
	 * Schedule the next poll tick.
	 * @private
	 */
	_schedulePoll() {
		this._pollTimer = setTimeout(async () => {
			await this._poll();
			if (this._connected) {
				this._schedulePoll();
			}
		}, this.pollIntervalMs);
	}

	/**
	 * Stop the poll loop.
	 * @private
	 */
	_stopPolling() {
		if (this._pollTimer !== null) {
			clearTimeout(this._pollTimer);
			this._pollTimer = null;
		}
	}

	/**
	 * Execute a single poll request and process any received messages.
	 * @private
	 * @returns {Promise<void>}
	 */
	async _poll() {
		if (!this.currentServerID) {
			return;
		}

		try {
			const data = await this.rest.get('/api/poll', {
				params: { id: this.currentServerID }
			});
			const messages = data && data.messages ? data.messages : [];
			for (const msg of messages) {
				this.handleSignalingMessage(msg);
			}
		} catch (error) {
			this.emitError(new Error(`Poll failed: ${error.message || 'Unknown error'}`));
		}
	}

	// ─── Signaling message handling ─────────────────────────────────────────

	/**
	 * Handle an incoming signaling message from the server.
	 *
	 * Supported types mirror the WebSocket variant:
	 * - offer / answer / ice-candidate (forwarded to the correct P2PConnection)
	 * - peer-joined / peer-left (room membership bookkeeping)
	 * - error
	 *
	 * @param {Object} data - Parsed signaling message.
	 * @returns {void}
	 */
	handleSignalingMessage(data) {
		switch (data.type) {
			case 'offer': {
				const from = data.from;
				if (!from) {
					console.warn('Offer received without `from` field:', data);
					return;
				}
				const p2p = this.createP2PConnection(from);
				p2p.receiveOffer(data.offer).catch((error) => {
					console.error(`Failed to receive offer from ${from}:`, error);
					this.emitPeerError(from, error);
				});
				break;
			}

			case 'answer': {
				const from = data.from;
				if (!from) {
					console.warn('Answer received without `from` field:', data);
					return;
				}
				const p2p = this.peers.get(from);
				if (p2p) {
					p2p.receiveAnswer(data.answer).catch((error) => {
						console.error(`Failed to receive answer from ${from}:`, error);
						this.emitPeerError(from, error);
					});
				} else {
					console.warn('Received answer for unknown peer:', from);
				}
				break;
			}

			case 'ice-candidate': {
				const from = data.from;
				if (!from) {
					console.warn('ICE candidate received without `from` field:', data);
					return;
				}
				const p2p = this.peers.get(from);
				if (p2p) {
					p2p.addIceCandidate(data.candidate).catch((error) => {
						console.error(`Failed to add ICE candidate from ${from}:`, error);
					});
				} else {
					console.warn('Received ICE candidate for unknown peer:', from);
				}
				break;
			}

			case 'peer-joined':
				if (data.peerId && !this.roomPeers.includes(data.peerId)) {
					this.roomPeers.push(data.peerId);
					console.log('Peer joined room:', data.peerId);
				}
				break;

			case 'peer-left':
				if (data.peerId) {
					this.roomPeers = this.roomPeers.filter((id) => id !== data.peerId);
					console.log('Peer left room:', data.peerId);
					this.disconnectPeer(data.peerId);
				}
				break;

			case 'error': {
				const errorMsg = data.message || 'Unknown server error';
				console.error('Server error:', errorMsg);
				this.emitError(new Error(errorMsg));
				break;
			}

			default:
				console.log('Unknown signaling message:', data);
		}
	}

	// ─── P2P connection management ──────────────────────────────────────────

	/**
	 * Create and wire a P2PConnection for a remote peer.
	 * If one already exists, returns it.
	 *
	 * @private
	 * @param {string} remotePeerId
	 * @returns {P2PConnection}
	 */
	createP2PConnection(remotePeerId) {
		if (this.peers.has(remotePeerId)) {
			return this.peers.get(remotePeerId);
		}

		const p2p = new P2PConnection();

		// Forward ICE candidates via REST
		p2p.onIceCandidate((candidate) => {
			this._sendSignal({
				type: 'ice-candidate',
				to: remotePeerId,
				candidate
			});
		});

		// Forward offers via REST
		p2p.onOffer((offer) => {
			this._sendSignal({
				type: 'offer',
				to: remotePeerId,
				offer
			}).catch((error) => {
				this.emitPeerError(remotePeerId, new Error(`Failed to send offer: ${error.message}`));
			});
		});

		// Forward answers via REST
		p2p.onAnswer((answer) => {
			this._sendSignal({
				type: 'answer',
				to: remotePeerId,
				answer
			}).catch((error) => {
				this.emitPeerError(remotePeerId, new Error(`Failed to send answer: ${error.message}`));
			});
		});

		// Application-level messages from this peer
		p2p.onMessage((message) => {
			this.onPeerMessageHandlers.forEach((h) => {
				try {
					h(remotePeerId, message);
				} catch (e) {
					console.error(`Error in peer message handler for ${remotePeerId}:`, e);
				}
			});
		});

		p2p.onConnected(() => {
			console.log(`P2P connection established with ${remotePeerId}`);
		});

		p2p.onDisconnected(() => {
			console.log(`P2P connection disconnected from ${remotePeerId}`);
		});

		this.peers.set(remotePeerId, p2p);
		return p2p;
	}

	/**
	 * Post a signaling payload to the REST API.
	 *
	 * @private
	 * @param {Object} message - Signaling payload (must include `type`).
	 * @returns {Promise<Object>}
	 */
	async _sendSignal(message) {
		if (!this.currentServerID) {
			throw new Error('Not connected – call connect() first');
		}
		return this.rest.post('/api/signal', {
			id: this.currentServerID,
			...message
		});
	}

	/**
	 * Initiate a P2P connection to a remote peer.
	 *
	 * @param {string} remotePeerId
	 * @returns {Promise<Object>} SDP offer.
	 */
	async initiateP2P(remotePeerId) {
		if (!remotePeerId || typeof remotePeerId !== 'string' || remotePeerId.trim() === '') {
			const error = new Error('Valid remotePeerId is required');
			this.emitError(error);
			throw error;
		}

		try {
			const p2p = this.createP2PConnection(remotePeerId);
			const offer = await p2p.initiate();
			return offer;
		} catch (error) {
			console.error(`Failed to initiate P2P connection with ${remotePeerId}:`, error);
			this.emitPeerError(remotePeerId, error);
			throw error;
		}
	}

	/**
	 * Send an application-level message over a specific P2P data channel.
	 *
	 * @param {string|Object} remotePeerIdOrMessage
	 * @param {string|Object} [message]
	 * @returns {boolean}
	 */
	sendMessage(remotePeerIdOrMessage, message) {
		let remotePeerId = null;
		let payload = message;

		if (typeof message === 'undefined') {
			payload = remotePeerIdOrMessage;
			const first = this.peers.values().next();
			if (first.done) {
				return false;
			}
			return first.value.send(payload);
		} else {
			remotePeerId = remotePeerIdOrMessage;
		}

		const p2p = this.peers.get(remotePeerId);
		if (!p2p) {
			console.warn('Attempt to send message to unknown peer:', remotePeerId);
			return false;
		}
		return p2p.send(payload);
	}

	/**
	 * Disconnect a specific peer and remove it from the map.
	 *
	 * @param {string} remotePeerId
	 * @returns {void}
	 */
	disconnectPeer(remotePeerId) {
		const p2p = this.peers.get(remotePeerId);
		if (p2p) {
			try {
				p2p.close();
			} catch (e) {
				console.warn('Error closing peer connection', remotePeerId, e);
			}
			this.peers.delete(remotePeerId);
		}
	}

	/**
	 * Get the list of peers in the current room.
	 *
	 * @returns {Array<string>}
	 */
	getRoomPeers() {
		return [...this.roomPeers];
	}

	/**
	 * Whether the client is currently connected.
	 *
	 * @returns {boolean}
	 */
	isConnected() {
		return this._connected;
	}

	// ─── Event registration ─────────────────────────────────────────────────

	/**
	 * Register a handler for general errors.
	 *
	 * @param {function(Error):void} handler
	 * @returns {void}
	 */
	onError(handler) {
		this.onErrorHandlers.push(handler);
	}

	/**
	 * Register a handler for peer-specific errors.
	 *
	 * @param {function(string, Error):void} handler
	 * @returns {void}
	 */
	onPeerError(handler) {
		this.onPeerErrorHandlers.push(handler);
	}

	/**
	 * Register a handler for incoming peer messages over the P2P data channel.
	 *
	 * @param {function(string, string):void} handler
	 * @returns {void}
	 */
	onPeerMessage(handler) {
		this.onPeerMessageHandlers.push(handler);
	}

	// ─── Internal helpers ───────────────────────────────────────────────────

	/**
	 * Emit a general error to all registered error handlers.
	 *
	 * @private
	 * @param {Error} error
	 * @returns {void}
	 */
	emitError(error) {
		this.onErrorHandlers.forEach((handler) => {
			try {
				handler(error);
			} catch (e) {
				console.error('Error in error handler:', e);
			}
		});
	}

	/**
	 * Emit a peer-specific error.
	 *
	 * @private
	 * @param {string} peerId
	 * @param {Error} error
	 * @returns {void}
	 */
	emitPeerError(peerId, error) {
		this.onPeerErrorHandlers.forEach((handler) => {
			try {
				handler(peerId, error);
			} catch (e) {
				console.error('Error in peer error handler:', e);
			}
		});
	}
}
