import { describe, it, expect, vi, beforeEach } from 'vitest';
import P2pMessageHelperModule from '../../workplaces/p2p-console-viewer-lib/src/p2p-message-helper.js';

const { P2pMessageHelper } = P2pMessageHelperModule;

describe('P2pMessageHelper', () => {
  describe('constructor', () => {
    it('should create instance with default options', () => {
      const helper = new P2pMessageHelper();
      
      expect(helper.namespace).toBeNull();
      expect(helper.consoleTarget).toBe(console);
      expect(helper.now).toBeDefined();
      expect(helper._idCounter).toBe(0);
    });

    it('should accept custom namespace', () => {
      const helper = new P2pMessageHelper({ namespace: 'test-namespace' });
      
      expect(helper.namespace).toBe('test-namespace');
    });

    it('should accept custom console target', () => {
      const mockConsole = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      
      const helper = new P2pMessageHelper({ consoleTarget: mockConsole });
      
      expect(helper.consoleTarget).toBe(mockConsole);
    });

    it('should accept custom timestamp provider', () => {
      const mockNow = vi.fn(() => 123456789);
      const helper = new P2pMessageHelper({ now: mockNow });
      
      expect(helper.now).toBe(mockNow);
    });
  });

  describe('_nextId', () => {
    it('should generate unique IDs', () => {
      const helper = new P2pMessageHelper();
      
      const id1 = helper._nextId();
      const id2 = helper._nextId();
      
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp in ID', () => {
      const mockNow = vi.fn(() => 987654321);
      const helper = new P2pMessageHelper({ now: mockNow });
      
      const id = helper._nextId();
      
      expect(id).toContain('987654321');
    });

    it('should increment counter', () => {
      const helper = new P2pMessageHelper();
      
      const id1 = helper._nextId();
      const id2 = helper._nextId();
      
      expect(id1).toContain('-1');
      expect(id2).toContain('-2');
    });
  });

  describe('_serializeArg', () => {
    let helper;

    beforeEach(() => {
      helper = new P2pMessageHelper();
    });

    it('should handle null and undefined', () => {
      expect(helper._serializeArg(null)).toBeNull();
      expect(helper._serializeArg(undefined)).toBeUndefined();
    });

    it('should handle primitives', () => {
      expect(helper._serializeArg('string')).toBe('string');
      expect(helper._serializeArg(123)).toBe(123);
      expect(helper._serializeArg(true)).toBe(true);
      expect(helper._serializeArg(false)).toBe(false);
    });

    it('should handle functions', () => {
      function namedFunc() {}
      const anonymousFunc = function() {};
      const arrowFunc = () => {};
      
      expect(helper._serializeArg(namedFunc)).toBe('[function:namedFunc]');
      expect(helper._serializeArg(anonymousFunc)).toContain('[function:');
      expect(helper._serializeArg(arrowFunc)).toContain('[function:');
    });

    it('should handle simple objects', () => {
      const obj = { a: 1, b: 'test' };
      const result = helper._serializeArg(obj);
      
      expect(result).toEqual({ a: 1, b: 'test' });
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 'three'];
      const result = helper._serializeArg(arr);
      
      expect(result).toEqual([1, 2, 'three']);
    });

    it('should handle nested objects', () => {
      const obj = {
        level1: {
          level2: {
            value: 'deep'
          }
        }
      };
      
      const result = helper._serializeArg(obj);
      expect(result).toEqual(obj);
    });

    it('should handle circular references with fallback', () => {
      const obj = { name: 'test' };
      obj.self = obj; // circular reference
      
      const result = helper._serializeArg(obj);
      
      // Should fallback to string representation
      expect(typeof result).toBe('string');
    });
  });

  describe('buildMessage', () => {
    it('should build message with all fields', () => {
      const helper = new P2pMessageHelper({ namespace: 'test' });
      
      const msg = helper.buildMessage('log', ['hello', 'world']);
      
      expect(msg).toHaveProperty('id');
      expect(msg).toHaveProperty('namespace', 'test');
      expect(msg).toHaveProperty('level', 'log');
      expect(msg).toHaveProperty('timestamp');
      expect(msg).toHaveProperty('payload');
      expect(msg).toHaveProperty('text');
    });

    it('should serialize arguments in payload', () => {
      const helper = new P2pMessageHelper();
      
      const msg = helper.buildMessage('info', ['test', 123, { key: 'value' }]);
      
      expect(msg.payload).toHaveLength(3);
      expect(msg.payload[0]).toBe('test');
      expect(msg.payload[1]).toBe(123);
      expect(msg.payload[2]).toEqual({ key: 'value' });
    });

    it('should create text from payload', () => {
      const helper = new P2pMessageHelper();
      
      const msg = helper.buildMessage('warn', ['warning:', 42]);
      
      expect(msg.text).toBe('warning: 42');
    });

    it('should stringify objects in text', () => {
      const helper = new P2pMessageHelper();
      
      const msg = helper.buildMessage('error', ['error:', { code: 500 }]);
      
      expect(msg.text).toContain('{"code":500}');
    });

    it('should handle empty arguments', () => {
      const helper = new P2pMessageHelper();
      
      const msg = helper.buildMessage('debug', []);
      
      expect(msg.payload).toEqual([]);
      expect(msg.text).toBe('');
    });
  });

  describe('console methods', () => {
    let helper;
    let mockConsole;

    beforeEach(() => {
      mockConsole = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      
      helper = new P2pMessageHelper({ consoleTarget: mockConsole });
    });

    it('should call console.log and return message', () => {
      const msg = helper.log('test message');
      
      expect(mockConsole.log).toHaveBeenCalledWith('test message');
      expect(msg.level).toBe('log');
      expect(msg.payload).toEqual(['test message']);
    });

    it('should call console.info and return message', () => {
      const msg = helper.info('info message');
      
      expect(mockConsole.info).toHaveBeenCalledWith('info message');
      expect(msg.level).toBe('info');
    });

    it('should call console.warn and return message', () => {
      const msg = helper.warn('warning');
      
      expect(mockConsole.warn).toHaveBeenCalledWith('warning');
      expect(msg.level).toBe('warn');
    });

    it('should call console.error and return message', () => {
      const msg = helper.error('error occurred');
      
      expect(mockConsole.error).toHaveBeenCalledWith('error occurred');
      expect(msg.level).toBe('error');
    });

    it('should call console.debug and return message', () => {
      const msg = helper.debug('debug info');
      
      expect(mockConsole.debug).toHaveBeenCalledWith('debug info');
      expect(msg.level).toBe('debug');
    });

    it('should handle multiple arguments', () => {
      const msg = helper.log('message', 123, { key: 'value' });
      
      expect(mockConsole.log).toHaveBeenCalledWith('message', 123, { key: 'value' });
      expect(msg.payload).toEqual(['message', 123, { key: 'value' }]);
    });

    it('should handle console call errors gracefully', () => {
      mockConsole.log = vi.fn(() => {
        throw new Error('Console error');
      });
      
      // Should not throw
      expect(() => {
        const msg = helper.log('test');
        expect(msg).toBeDefined();
      }).not.toThrow();
    });

    it('should fallback to console.log if method missing', () => {
      mockConsole.customMethod = undefined;
      helper.consoleTarget.customMethod = mockConsole.log;
      
      const msg = helper._emit('customMethod', 'test');
      
      expect(msg).toBeDefined();
    });
  });

  describe('static serialize', () => {
    it('should serialize message to JSON', () => {
      const message = {
        id: '123',
        level: 'log',
        timestamp: 1234567890,
        text: 'test message',
        payload: ['test'],
      };
      
      const json = P2pMessageHelper.serialize(message);
      
      expect(json).toBe(JSON.stringify(message));
    });

    it('should handle serialization errors with fallback', () => {
      const circularMessage = {
        id: '123',
        level: 'log',
        timestamp: 1234567890,
        text: 'test',
      };
      circularMessage.self = circularMessage; // circular reference
      
      const json = P2pMessageHelper.serialize(circularMessage);
      
      // Should return fallback JSON
      expect(json).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include essential fields in fallback', () => {
      const message = {
        id: '123',
        level: 'error',
        timestamp: 999,
        text: 'error text',
      };
      message.circular = message;
      
      const json = P2pMessageHelper.serialize(message);
      const parsed = JSON.parse(json);
      
      expect(parsed.id).toBe('123');
      expect(parsed.level).toBe('error');
      expect(parsed.timestamp).toBe(999);
    });
  });

  describe('static parse', () => {
    it('should parse valid JSON', () => {
      const json = '{"id":"123","level":"log","text":"test"}';
      
      const message = P2pMessageHelper.parse(json);
      
      expect(message).toEqual({
        id: '123',
        level: 'log',
        text: 'test',
      });
    });

    it('should return null for invalid JSON', () => {
      const invalidJson = '{invalid json}';
      
      const message = P2pMessageHelper.parse(invalidJson);
      
      expect(message).toBeNull();
    });

    it('should handle empty string', () => {
      const message = P2pMessageHelper.parse('');
      
      expect(message).toBeNull();
    });
  });

  describe('static isConsoleMessage', () => {
    it('should identify valid console message', () => {
      const message = {
        id: '123',
        level: 'log',
        timestamp: 1234567890,
        text: 'test',
      };
      
      expect(P2pMessageHelper.isConsoleMessage(message)).toBe(true);
    });

    it('should require level field', () => {
      const message = {
        id: '123',
        timestamp: 1234567890,
        text: 'test',
      };
      
      expect(P2pMessageHelper.isConsoleMessage(message)).toBe(false);
    });

    it('should require timestamp field', () => {
      const message = {
        id: '123',
        level: 'log',
        text: 'test',
      };
      
      expect(P2pMessageHelper.isConsoleMessage(message)).toBe(false);
    });

    it('should reject null', () => {
      expect(P2pMessageHelper.isConsoleMessage(null)).toBeFalsy();
    });

    it('should reject non-object', () => {
      expect(P2pMessageHelper.isConsoleMessage('string')).toBe(false);
      expect(P2pMessageHelper.isConsoleMessage(123)).toBe(false);
    });

    it('should accept message with timestamp 0', () => {
      const message = {
        level: 'log',
        timestamp: 0,
      };
      
      expect(P2pMessageHelper.isConsoleMessage(message)).toBe(true);
    });
  });

  describe('integration', () => {
    it('should work end-to-end', () => {
      const helper = new P2pMessageHelper({ namespace: 'test-app' });
      
      const msg = helper.log('User logged in', { userId: 123 });
      
      expect(msg.namespace).toBe('test-app');
      expect(msg.level).toBe('log');
      expect(msg.text).toContain('User logged in');
      expect(msg.text).toContain('userId');
      
      const serialized = P2pMessageHelper.serialize(msg);
      expect(serialized).toBeDefined();
      
      const parsed = P2pMessageHelper.parse(serialized);
      expect(parsed).toEqual(msg);
      
      expect(P2pMessageHelper.isConsoleMessage(parsed)).toBe(true);
    });
  });
});
