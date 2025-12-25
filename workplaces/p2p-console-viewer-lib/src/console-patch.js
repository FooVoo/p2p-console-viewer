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
   * Create a ConsoleInterceptor.
   *
   * Initializes storage for original console methods and patch state.
   */
  constructor() {
    /**
     * Map of original console method implementations (e.g. { log: Function, warn: Function }).
     * Stored implementations are bound to the original console to preserve context.
     * @type {Object<string,Function>}
     */
    this.originalMethods = {};

    /**
     * Whether console has been patched by this interceptor.
     * @type {boolean}
     */
    this.isPatched = false;
  }

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
  patch(callback) {
    if (this.isPatched) return;

    const methodsToPatch = ["log", "info", "warn", "error", "debug"];

    methodsToPatch.forEach((method) => {
      // Save the current implementation (might already be patched by others)
      this.originalMethods[method] = console[method].bind(console);

      // Replace with wrapped version
      console[method] = (...args) => {
        callback(method, ...args);
        // Call the previous implementation first
        this.originalMethods[method](...args);
      };
    });

    this.isPatched = true;
  }

  /**
   * Restore the original console methods that were replaced by `patch`.
   *
   * If not patched, this is a no-op.
   */
  unpatch() {
    if (!this.isPatched) return;

    Object.keys(this.originalMethods).forEach((method) => {
      console[method] = this.originalMethods[method];
    });

    this.isPatched = false;
  }
}
