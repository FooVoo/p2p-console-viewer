import { CLIENT_TTL, ALLOWED_ORIGINS } from '../lib/guardrails.mjs';
import { roomManager } from '../lib/shared-state.mjs';
import { withCors } from '../lib/cors.mjs';

/**
 * Factory that returns a `GET /api/poll` handler backed by `roomManager`.
 *
 * Clients call this endpoint periodically to receive messages that were
 * queued for them (peer-joined, peer-left, offer, answer, ice-candidate …).
 * Each call drains the queue atomically and resets the client's idle timer.
 * Stale clients (idle longer than CLIENT_TTL) are evicted on each poll.
 *
 * Query param: `id=<clientId>`
 * Response:    `{ messages: object[] }`
 *
 * @param {import('../lib/room-manager.mjs').RoomManager} roomManager
 * @param {string[]} [allowedOrigins]
 * @returns {(request: Request) => Promise<Response>}
 */
export function createPollHandler(roomManager, allowedOrigins = ALLOWED_ORIGINS) {
	return withCors(async (request) => {
		try {
			if (request.method !== 'GET') {
				return new Response(JSON.stringify({ error: 'method-not-allowed' }), { status: 405 });
			}

			const id = new URL(request.url).searchParams.get('id');

			if (!id || typeof id !== 'string') {
				return new Response(JSON.stringify({ error: 'invalid-id' }), { status: 400 });
			}

			roomManager.evictStale(CLIENT_TTL);

			const messages = roomManager.drainQueue(id);

			if (messages === null) {
				return new Response(JSON.stringify({ error: 'client-not-found' }), { status: 404 });
			}

			return new Response(JSON.stringify({ messages }), { status: 200 });
		} catch (err) {
			console.error('poll handler error:', err);
			return new Response(JSON.stringify({ error: 'internal-error' }), { status: 500 });
		}
	}, allowedOrigins);
}

const _pollHandler = createPollHandler(roomManager);

export default {
	fetch(request) {
		return _pollHandler(request);
	}
};
