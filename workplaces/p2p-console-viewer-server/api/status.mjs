import { roomManager } from '../lib/shared-state.mjs';
import { ALLOWED_ORIGINS } from '../lib/guardrails.mjs';
import { withCors } from '../lib/cors.mjs';

/**
 * Factory that returns a `GET /api/status` handler backed by `roomManager`.
 *
 * Response: `{ totalClients: number, clients: string[], rooms: object }`
 *
 * @param {import('../lib/room-manager.mjs').RoomManager} roomManager
 * @param {string[]} [allowedOrigins]
 * @returns {(request: Request) => Promise<Response>}
 */
export function createStatusHandler(roomManager, allowedOrigins = ALLOWED_ORIGINS) {
	return withCors(async (request) => {
		try {
			if (request.method !== 'GET') {
				return new Response(JSON.stringify({ error: 'method-not-allowed' }), { status: 405 });
			}

			console.log('Status request from:', request.headers.get('x-forwarded-for') ?? 'unknown');
			return new Response(JSON.stringify(roomManager.getStatus()), { status: 200 });
		} catch (err) {
			console.error('status handler error:', err);
			return new Response(JSON.stringify({ error: 'internal-error' }), { status: 500 });
		}
	}, allowedOrigins);
}

const _statusHandler = createStatusHandler(roomManager);

export default {
	fetch(request) {
		return _statusHandler(request);
	}
};
