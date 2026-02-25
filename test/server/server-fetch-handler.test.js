import { describe, it, expect } from 'vitest';
import server from '../../workplaces/p2p-console-viewer-server/server.js';

const BASE_URL = 'http://localhost';

describe('Vercel edge runtime fetch handler', () => {
	it('exports a default object with a fetch method', () => {
		expect(server).toBeDefined();
		expect(typeof server.fetch).toBe('function');
	});

	it('returns 404 for unknown routes', async () => {
		const response = await server.fetch(new Request(`${BASE_URL}/`));
		expect(response.status).toBe(404);
	});

	it('routes /api/status to the status handler', async () => {
		const response = await server.fetch(new Request(`${BASE_URL}/api/status`));
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.totalClients).toBe(0);
		expect(body.clients).toEqual([]);
		expect(body.rooms).toEqual({});
	});

	it('routes /api/join to the join handler', async () => {
		const response = await server.fetch(
			new Request(`${BASE_URL}/api/join`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ room: 'test-room' })
			})
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(typeof body.id).toBe('string');
		expect(body.room).toBe('test-room');
	});

	it('routes /api/poll to the poll handler', async () => {
		const response = await server.fetch(
			new Request(`${BASE_URL}/api/poll?id=nonexistent`)
		);
		expect(response.status).toBe(404);
	});

	it('routes /api/leave to the leave handler', async () => {
		const response = await server.fetch(
			new Request(`${BASE_URL}/api/leave`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: 'nonexistent' })
			})
		);
		expect(response.status).toBe(200);
	});

	it('routes /api/signal to the signal handler', async () => {
		const response = await server.fetch(
			new Request(`${BASE_URL}/api/signal`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: 'ghost', type: 'offer' })
			})
		);
		expect(response.status).toBe(404);
	});
});
