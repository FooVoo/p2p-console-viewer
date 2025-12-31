/**
 * Custom error thrown for non-2xx HTTP responses.
 */
export class RestError extends Error {
	status: number;
	body: any;

	/**
	 * @param {string} message
	 * @param {number} status
	 * @param {*} body
	 */
	constructor(message: string, status: number, body: any);
}

/**
 * @typedef {Object.<string, string|number|boolean|null|undefined>} QueryParams
 * @typedef {Object.<string, string>} HeadersMap
 *
 * @typedef {Object} RequestOptions
 * @property {QueryParams} [params]
 * @property {HeadersMap} [headers]
 * @property {number} [timeoutMs]
 * @property {AbortSignal} [signal]
 */
/**
 * Simple REST client using fetch with JSON handling, timeouts and default headers.
 */
export class RestClient {
	baseUrl: string;
	defaultHeaders: {
		[x: string]: string;
	};
	defaultTimeoutMs: number;

	/**
	 * @param {string} [baseUrl]
	 * @param {HeadersMap} [defaultHeaders]
	 * @param {number} [defaultTimeoutMs]
	 */
	constructor(baseUrl?: string, defaultHeaders?: HeadersMap, defaultTimeoutMs?: number);

	/**
	 * Build full URL with optional query params.
	 * @param {string} path
	 * @param {QueryParams} [params]
	 * @returns {string}
	 */
	buildUrl(path: string, params?: QueryParams): string;

	/**
	 * Internal request helper.
	 * @template T
	 * @param {string} method
	 * @param {string} path
	 * @param {RequestOptions} [opts]
	 * @param {*} [body]
	 * @returns {Promise<T>}
	 */
	request<T>(method: string, path: string, opts?: RequestOptions, body?: any): Promise<T>;

	/**
	 * @template T
	 * @param {string} path
	 * @param {RequestOptions} [opts]
	 * @returns {Promise<T>}
	 */
	get<T>(path: string, opts?: RequestOptions): Promise<T>;

	/**
	 * @template T
	 * @param {string} path
	 * @param {*} [body]
	 * @param {RequestOptions} [opts]
	 * @returns {Promise<T>}
	 */
	post<T>(path: string, body?: any, opts?: RequestOptions): Promise<T>;

	/**
	 * @template T
	 * @param {string} path
	 * @param {*} [body]
	 * @param {RequestOptions} [opts]
	 * @returns {Promise<T>}
	 */
	put<T>(path: string, body?: any, opts?: RequestOptions): Promise<T>;

	/**
	 * @template T
	 * @param {string} path
	 * @param {*} [body]
	 * @param {RequestOptions} [opts]
	 * @returns {Promise<T>}
	 */
	patch<T>(path: string, body?: any, opts?: RequestOptions): Promise<T>;

	/**
	 * @template T
	 * @param {string} path
	 * @param {RequestOptions} [opts]
	 * @returns {Promise<T>}
	 */
	delete<T>(path: string, opts?: RequestOptions): Promise<T>;
}

export type QueryParams = {
	[x: string]: string | number | boolean;
};
export type HeadersMap = {
	[x: string]: string;
};
export type RequestOptions = {
	params?: QueryParams;
	headers?: HeadersMap;
	timeoutMs?: number;
	signal?: AbortSignal;
};
