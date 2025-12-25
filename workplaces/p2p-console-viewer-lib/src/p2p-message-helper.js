// javascript
/**
 * P2pMessageHelper
 *
 * Builds structured message objects for console events and forwards
 * to the underlying console methods (log/info/warn/error/debug).
 *
 * Designed as a simple base for sending console-originated messages over P2P.
 */
class P2pMessageHelper {
    /**
     * @param {Object} [opts]
     * @param {string} [opts.namespace] - Optional namespace to include in messages.
     * @param {Console} [opts.consoleTarget=console] - Console-like target to call.
     * @param {function():number} [opts.now=() => Date.now()] - Timestamp provider.
     */
    constructor(opts = {}) {
        this.namespace = opts.namespace || null;
        this.consoleTarget = opts.consoleTarget || console;
        this.now = opts.now || (() => Date.now());
        this._idCounter = 0;
    }

    /**
     * Create a unique id for each message.
     * @private
     * @returns {string}
     */
    _nextId() {
        this._idCounter += 1;
        return `${this.now()}-${Math.random().toString(36).slice(2, 8)}-${this._idCounter}`;
    }

    /**
     * Safely convert an argument to a serializable representation.
     * - Primitives are returned as-is.
     * - Objects/arrays are JSON-stringified where possible.
     * - Functions replaced with a placeholder.
     * @private
     * @param {*} arg
     * @returns {*}
     */
    _serializeArg(arg) {
        if (arg === null || arg === undefined) return arg;
        const t = typeof arg;
        if (t === 'string' || t === 'number' || t === 'boolean') return arg;
        if (t === 'function') return `[function:${arg.name || 'anonymous'}]`;
        try {
            return JSON.parse(JSON.stringify(arg));
        } catch (e) {
            // Fallback to toString for circular/complex values
            try {
                return String(arg);
            } catch (e2) {
                return `[unserializable:${t}]`;
            }
        }
    }

    /**
     * Build a structured message object for the given level and args.
     * @param {'log'|'info'|'warn'|'error'|'debug'} level
     * @param {Array<any>} args
     * @returns {Object} Message object
     */
    buildMessage(level, args) {
        const id = this._nextId();
        const timestamp = this.now();
        const payload = args.map(a => this._serializeArg(a));
        const text = payload.map(p => (typeof p === 'object' ? JSON.stringify(p) : String(p))).join(' ');

        const msg = {
            id,
            namespace: this.namespace,
            level,
            timestamp,
            payload,
            text
        };

        return msg;
    }

    /**
     * Generic handler: call console method and return the built message.
     * @private
     * @param {'log'|'info'|'warn'|'error'|'debug'} method
     * @param {...any} args
     * @returns {Object} message built by buildMessage
     */
    _emit(method, ...args) {
        // call the underlying console method (if exists)
        const targetMethod = this.consoleTarget[method] || this.consoleTarget.log || (() => {});
        try {
            targetMethod.apply(this.consoleTarget, args);
        } catch (e) {
            // ignore console call errors to avoid breaking message creation
            try {
                (this.consoleTarget.log || (() => {})).call(this.consoleTarget, 'Console call failed:', e);
            } catch (e2) { /* noop */ }
        }

        return this.buildMessage(method, args);
    }

    /**
     * Console-like helpers that forward to console and return message objects.
     * Usage: const msg = helper.log('hello', obj);
     */

    log(...args) { return this._emit('log', ...args); }
    info(...args) { return this._emit('info', ...args); }
    warn(...args) { return this._emit('warn', ...args); }
    error(...args) { return this._emit('error', ...args); }
    debug(...args) { return this._emit('debug', ...args); }

    /**
     * Serialize a message object to JSON string for sending.
     * @param {Object} message
     * @returns {string}
     */
    static serialize(message) {
        try {
            return JSON.stringify(message);
        } catch (e) {
            // Best-effort fallback
            return JSON.stringify({
                id: message && message.id,
                level: message && message.level,
                timestamp: message && message.timestamp,
                text: message && message.text || '[unserializable]'
            });
        }
    }

    /**
     * Parse a JSON string back to a message object.
     * @param {string} json
     * @returns {Object|null}
     */
    static parse(json) {
        try {
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    /**
     * Quick predicate to identify console-originated messages (by shape).
     * @param {Object} msg
     * @returns {boolean}
     */
    static isConsoleMessage(msg) {
        return msg && typeof msg === 'object' && typeof msg.level === 'string' && typeof msg.timestamp !== 'undefined';
    }
}

export default { P2pMessageHelper };
