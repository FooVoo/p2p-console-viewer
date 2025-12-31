/**
 * Custom error thrown for non-2xx HTTP responses.
 */
export class RestError extends Error {
    /**
     * @param {string} message
     * @param {number} status
     * @param {*} body
     */
    constructor(message, status, body) {
        super(message);
        this.name = 'RestError';
        this.status = status;
        this.body = body;
    }
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
    /**
     * @param {string} [baseUrl]
     * @param {HeadersMap} [defaultHeaders]
     * @param {number} [defaultTimeoutMs]
     */
    constructor(baseUrl = '', defaultHeaders = {}, defaultTimeoutMs = 30000) {
        this.baseUrl = baseUrl;
        this.defaultHeaders = defaultHeaders;
        this.defaultTimeoutMs = defaultTimeoutMs;
    }

    /**
     * Build full URL with optional query params.
     * @param {string} path
     * @param {QueryParams} [params]
     * @returns {string}
     */
    buildUrl(path, params) {
        const base = this.baseUrl || '';
        const url = new URL(path, base);
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
            });
        }
        return url.toString();
    }

    /**
     * Internal request helper.
     * @template T
     * @param {string} method
     * @param {string} path
     * @param {RequestOptions} [opts]
     * @param {*} [body]
     * @returns {Promise<T>}
     */
    async request(method, path, opts = {}, body) {
        const {params, headers, timeoutMs, signal} = opts;
        const url = this.buildUrl(path, params);

        const controller = new AbortController();
        let timedOut = false;
        let abortedByExternal = false;

        const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;
        let timer;
        if (effectiveTimeout) {
            timer = setTimeout(() => {
                timedOut = true;
                controller.abort();
            }, effectiveTimeout);
        }

        // If an external signal is provided, forward its abort to our controller
        let externalAbortHandler;
        if (signal) {
            if (signal.aborted) {
                // already aborted
                throw new Error('Request aborted');
            }
            externalAbortHandler = () => {
                abortedByExternal = true;
                controller.abort();
            };
            signal.addEventListener('abort', externalAbortHandler);
        }

        const mergedHeaders = Object.assign({}, this.defaultHeaders, headers || {});
        const init = {
            method,
            headers: mergedHeaders,
            signal: controller.signal
        };

        if (body !== undefined) {
            if (
                (typeof FormData !== 'undefined' && body instanceof FormData) ||
                (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) ||
                typeof body === 'string'
            ) {
                init.body = body;
            } else {
                init.body = JSON.stringify(body);
                if (!mergedHeaders['Content-Type']) mergedHeaders['Content-Type'] = 'application/json';
            }
        }

        try {
            const res = await fetch(url, init);
            const text = await res.text();
            const parsed = text ? JSON.parse(text) : null;
            if (!res.ok) {
                throw new RestError('HTTP error', res.status, parsed);
            }
            return parsed;
        } catch (err) {
            if (err && err.name === 'AbortError') {
                if (timedOut) throw new Error('Request timed out');
                if (abortedByExternal) throw new Error('Request aborted');
                throw new Error('Request aborted');
            }
            throw err;
        } finally {
            if (timer) clearTimeout(timer);
            if (signal && externalAbortHandler) {
                signal.removeEventListener('abort', externalAbortHandler);
            }
        }
    }

    /**
     * @template T
     * @param {string} path
     * @param {RequestOptions} [opts]
     * @returns {Promise<T>}
     */
    get(path, opts) {
        return this.request('GET', path, opts);
    }

    /**
     * @template T
     * @param {string} path
     * @param {*} [body]
     * @param {RequestOptions} [opts]
     * @returns {Promise<T>}
     */
    post(path, body, opts) {
        return this.request('POST', path, opts, body);
    }

    /**
     * @template T
     * @param {string} path
     * @param {*} [body]
     * @param {RequestOptions} [opts]
     * @returns {Promise<T>}
     */
    put(path, body, opts) {
        return this.request('PUT', path, opts, body);
    }

    /**
     * @template T
     * @param {string} path
     * @param {*} [body]
     * @param {RequestOptions} [opts]
     * @returns {Promise<T>}
     */
    patch(path, body, opts) {
        return this.request('PATCH', path, opts, body);
    }

    /**
     * @template T
     * @param {string} path
     * @param {RequestOptions} [opts]
     * @returns {Promise<T>}
     */
    delete(path, opts) {
        return this.request('DELETE', path, opts);
    }
}
