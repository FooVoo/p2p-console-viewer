export class ConsoleInterceptor {
    constructor() {
        this.originalMethods = {};
        this.isPatched = false;
    }

    // Apply the monkey patch
    patch() {
        if (this.isPatched) return;

        const methodsToPatch = ['log', 'info', 'warn', 'error', 'debug'];

        methodsToPatch.forEach(method => {
            // Save the current implementation (might already be patched by others)
            this.originalMethods[method] = console[method].bind(console);

            // Replace with wrapped version
            console[method] = (...args) => {
                // Call the previous implementation first
                this.originalMethods[method](...args);
            };
        });

        this.isPatched = true;
    }

    unpatch() {
        if (!this.isPatched) return;

        Object.keys(this.originalMethods).forEach(method => {
            console[method] = this.originalMethods[method];
        });

        this.isPatched = false;
    }
}
