declare namespace _default {
    export { P2pMessageHelper };
}
export default _default;
/**
 * P2pMessageHelper
 *
 * Builds structured message objects for console events and forwards
 * to the underlying console methods (log/info/warn/error/debug).
 *
 * Designed as a simple base for sending console-originated messages over P2P.
 */
declare class P2pMessageHelper {
    /**
     * Serialize a message object to JSON string for sending.
     * @param {Object} message
     * @returns {string}
     */
    static serialize(message: any): string;
    /**
     * Parse a JSON string back to a message object.
     * @param {string} json
     * @returns {Object|null}
     */
    static parse(json: string): any | null;
    /**
     * Quick predicate to identify console-originated messages (by shape).
     * @param {Object} msg
     * @returns {boolean}
     */
    static isConsoleMessage(msg: any): boolean;
    /**
     * @param {Object} [opts]
     * @param {string} [opts.namespace] - Optional namespace to include in messages.
     * @param {Console} [opts.consoleTarget=console] - Console-like target to call.
     * @param {function():number} [opts.now=() => Date.now()] - Timestamp provider.
     */
    constructor(opts?: {
        namespace?: string;
        consoleTarget?: Console;
        now?: () => number;
    });
    namespace: string;
    consoleTarget: Console;
    now: () => number;
    _idCounter: number;
    /**
     * Create a unique id for each message.
     * @private
     * @returns {string}
     */
    private _nextId;
    /**
     * Safely convert an argument to a serializable representation.
     * - Primitives are returned as-is.
     * - Objects/arrays are JSON-stringified where possible.
     * - Functions replaced with a placeholder.
     * @private
     * @param {*} arg
     * @returns {*}
     */
    private _serializeArg;
    /**
     * Build a structured message object for the given level and args.
     * @param {'log'|'info'|'warn'|'error'|'debug'} level
     * @param {Array<any>} args
     * @returns {Object} Message object
     */
    buildMessage(level: "log" | "info" | "warn" | "error" | "debug", args: Array<any>): any;
    /**
     * Generic handler: call console method and return the built message.
     * @private
     * @param {'log'|'info'|'warn'|'error'|'debug'} method
     * @param {...any} args
     * @returns {Object} message built by buildMessage
     */
    private _emit;
    /**
     * Console-like helpers that forward to console and return message objects.
     * Usage: const msg = helper.log('hello', obj);
     */
    log(...args: any[]): any;
    info(...args: any[]): any;
    warn(...args: any[]): any;
    error(...args: any[]): any;
    debug(...args: any[]): any;
}
