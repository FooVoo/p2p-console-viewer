/**
 * ConsoleInterceptor
 *
 * Utility to monkey-patch browser/node `console` methods so each call is forwarded
 * to a provided callback while preserving the previous console behavior.
 *
 * Typical use:
 * const interceptor = new ConsoleInterceptor();
 * interceptor.patch((method, ...args) => { /* handle log });
 * later
 * interceptor.unpatch();
 */
export class ConsoleInterceptor {
    /**
     * Map of original console method implementations (e.g. { log: Function, warn: Function }).
     * Stored implementations are bound to the original console to preserve context.
     * @type {Object<string,Function>}
     */
    originalMethods: {
        [x: string]: Function;
    };
    /**
     * Whether console has been patched by this interceptor.
     * @type {boolean}
     */
    isPatched: boolean;
    /**
     * Apply the monkey patch to console methods.
     *
     * Replaces the methods specified in `methodsToPatch` with wrappers that:
     * 1. Invoke the provided `callback` with the method name and original arguments.
     * 2. Call the previously saved implementation so other listeners / original behavior runs.
     *
     * If already patched, this is a no-op.
     *
     * @param {function(string, ...*):void} callback - Function invoked for each console call.
     */
    patch(callback: (arg0: string, ...args: any[]) => void): void;
    /**
     * Restore the original console methods that were replaced by `patch`.
     *
     * If not patched, this is a no-op.
     */
    unpatch(): void;
}
