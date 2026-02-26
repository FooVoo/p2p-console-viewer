/**
 * CORS utilities for the serverless-style API handlers.
 *
 * When ALLOWED_ORIGINS is empty every origin is accepted (`*`).
 * When it contains a list only matching origins are reflected back.
 */

const CORS_ALLOW_METHODS = 'GET, POST, OPTIONS';
const CORS_ALLOW_HEADERS = 'Content-Type';

/**
 * Returns the CORS headers appropriate for the incoming request.
 *
 * @param {Request} request
 * @param {string[]} allowedOrigins
 * @returns {Record<string, string>}
 */
export function getCorsHeaders(request, allowedOrigins) {
	const origin = request.headers.get('origin') || '';

	if (allowedOrigins.length === 0) {
		return { 'Access-Control-Allow-Origin': '*' };
	}

	if (allowedOrigins.includes(origin)) {
		return {
			'Access-Control-Allow-Origin': origin,
			Vary: 'Origin'
		};
	}

	return {};
}

/**
 * Wraps a handler so that every response carries CORS headers and
 * OPTIONS preflight requests are answered automatically.
 *
 * @param {(request: Request) => Promise<Response>} handler
 * @param {string[]} allowedOrigins
 * @returns {(request: Request) => Promise<Response>}
 */
export function withCors(handler, allowedOrigins) {
	return async (request) => {
		const corsHeaders = getCorsHeaders(request, allowedOrigins);

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					...corsHeaders,
					'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
					'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS
				}
			});
		}

		const response = await handler(request);

		const newHeaders = new Headers(response.headers);
		for (const [key, value] of Object.entries(corsHeaders)) {
			newHeaders.set(key, value);
		}

		return new Response(response.body, {
			status: response.status,
			headers: newHeaders
		});
	};
}
