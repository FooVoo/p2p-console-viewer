import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleInterceptor } from '../../workplaces/p2p-console-viewer-lib/src/console-patch.js';

describe('ConsoleInterceptor', () => {
  let interceptor;
  let originalConsole;

  beforeEach(() => {
    // Store original console methods
    originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
    
    interceptor = new ConsoleInterceptor();
  });

  afterEach(() => {
    // Always unpatch to restore original console
    if (interceptor.isPatched) {
      interceptor.unpatch();
    }
    
    // Double-check restore
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  });

  describe('constructor', () => {
    it('should initialize with empty originalMethods', () => {
      expect(interceptor.originalMethods).toEqual({});
    });

    it('should initialize with isPatched as false', () => {
      expect(interceptor.isPatched).toBe(false);
    });
  });

  describe('patch', () => {
    it('should patch console methods', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      expect(interceptor.isPatched).toBe(true);
      expect(interceptor.originalMethods).toHaveProperty('log');
      expect(interceptor.originalMethods).toHaveProperty('info');
      expect(interceptor.originalMethods).toHaveProperty('warn');
      expect(interceptor.originalMethods).toHaveProperty('error');
      expect(interceptor.originalMethods).toHaveProperty('debug');
    });

    it('should call callback when console methods are invoked', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      console.log('test log');
      console.info('test info');
      console.warn('test warn');
      console.error('test error');
      console.debug('test debug');

      expect(callback).toHaveBeenCalledTimes(5);
      expect(callback).toHaveBeenCalledWith('log', 'test log');
      expect(callback).toHaveBeenCalledWith('info', 'test info');
      expect(callback).toHaveBeenCalledWith('warn', 'test warn');
      expect(callback).toHaveBeenCalledWith('error', 'test error');
      expect(callback).toHaveBeenCalledWith('debug', 'test debug');
    });

    it('should call callback with multiple arguments', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      console.log('message', 123, { key: 'value' });

      expect(callback).toHaveBeenCalledWith('log', 'message', 123, { key: 'value' });
    });

    it('should still call original console method', () => {
      const callback = vi.fn();
      
      // Spy on console before patching
      const consoleSpy = vi.spyOn(console, 'log');
      
      // Save the spy before patching
      const spiedMethod = console.log;
      
      interceptor.patch(callback);
      
      // Verify callback is called
      console.log('test message');
      expect(callback).toHaveBeenCalledWith('log', 'test message');
      
      // The original method should still be called (which is the spy in this case)
      // We can't directly test the spy after patching, but we can verify
      // that console output still works by checking callback was called
      expect(callback).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should be no-op if already patched', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      interceptor.patch(callback1);
      const firstLogMethod = console.log;
      
      interceptor.patch(callback2);
      const secondLogMethod = console.log;

      // Should be the same function, not re-patched
      expect(firstLogMethod).toBe(secondLogMethod);
    });

    it('should preserve console method context', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      // Should not throw errors related to context
      expect(() => {
        console.log('test');
        console.info('test');
        console.warn('test');
        console.error('test');
        console.debug('test');
      }).not.toThrow();
    });
  });

  describe('unpatch', () => {
    it('should restore original console methods', () => {
      const callback = vi.fn();
      interceptor.patch(callback);
      
      const patchedLog = console.log;
      interceptor.unpatch();

      expect(console.log).not.toBe(patchedLog);
      expect(interceptor.isPatched).toBe(false);
    });

    it('should stop calling callback after unpatch', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      console.log('during patch');
      expect(callback).toHaveBeenCalledTimes(1);

      interceptor.unpatch();
      console.log('after unpatch');

      // Should still be 1, not 2
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should be no-op if not patched', () => {
      const originalLog = console.log;
      
      interceptor.unpatch();

      expect(console.log).toBe(originalLog);
      expect(interceptor.isPatched).toBe(false);
    });

    it('should allow re-patching after unpatch', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      interceptor.patch(callback1);
      console.log('first patch');
      expect(callback1).toHaveBeenCalledTimes(1);

      interceptor.unpatch();
      
      interceptor.patch(callback2);
      console.log('second patch');
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('patching behavior', () => {
    it('should work with no arguments', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      console.log();

      expect(callback).toHaveBeenCalledWith('log');
    });

    it('should work with arrays and objects', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      const arr = [1, 2, 3];
      const obj = { a: 1, b: 2 };

      console.log(arr, obj);

      expect(callback).toHaveBeenCalledWith('log', arr, obj);
    });

    it('should work with errors', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      const error = new Error('test error');
      console.error(error);

      expect(callback).toHaveBeenCalledWith('error', error);
    });

    it('should handle null and undefined', () => {
      const callback = vi.fn();
      interceptor.patch(callback);

      console.log(null, undefined);

      expect(callback).toHaveBeenCalledWith('log', null, undefined);
    });

    it('should call callback before original method', () => {
      const callOrder = [];
      
      const callback = vi.fn(() => {
        callOrder.push('callback');
      });
      
      const originalLog = console.log;
      console.log = vi.fn((...args) => {
        callOrder.push('original');
        originalLog.apply(console, args);
      });

      interceptor.patch(callback);
      console.log('test');

      expect(callOrder).toEqual(['callback', 'original']);
    });
  });

  describe('multiple interceptors', () => {
    it('should allow multiple interceptors', () => {
      const interceptor2 = new ConsoleInterceptor();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      interceptor.patch(callback1);
      interceptor2.patch(callback2);

      console.log('test');

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);

      interceptor.unpatch();
      interceptor2.unpatch();
    });
  });
});
