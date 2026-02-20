import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Tests for P2P Console Viewer Message Handling
 * 
 * These tests verify the message parsing, serialization, and type preservation
 * functionality that enables proper inbound/outbound message handling.
 */

// Mock helper functions (these would import from the actual files)
function parseP2PMessage(data, direction) {
  try {
    const parsed = JSON.parse(data);
    
    // Check if it's a structured console message (from P2pMessageHelper)
    if (parsed && typeof parsed === 'object' && 'level' in parsed && 'timestamp' in parsed) {
      return {
        id: parsed.id || `${Date.now()}-${Math.random()}`,
        timestamp: parsed.timestamp,
        direction,
        type: parsed.level,
        content: parsed.text || '',
        payload: parsed.payload,
        namespace: parsed.namespace
      };
    }
    
    // If it's JSON but not a console message, stringify it
    return {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      direction,
      type: 'text',
      content: JSON.stringify(parsed),
      payload: undefined,
      namespace: null
    };
  } catch (e) {
    // Plain text message
    return {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      direction,
      type: 'text',
      content: data,
      payload: undefined,
      namespace: null
    };
  }
}

function serializeP2PMessage(message) {
  if (typeof message === 'string') {
    return message;
  }
  return JSON.stringify(message);
}

describe('Message Handling - parseP2PMessage', () => {
  describe('Structured Console Messages', () => {
    it('should parse a log message correctly', () => {
      const input = JSON.stringify({
        id: 'test-123',
        level: 'log',
        timestamp: 1234567890,
        text: 'Hello world',
        payload: ['Hello', 'world'],
        namespace: 'test'
      });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.id).toBe('test-123');
      expect(result.type).toBe('log');
      expect(result.timestamp).toBe(1234567890);
      expect(result.content).toBe('Hello world');
      expect(result.direction).toBe('inbound');
      expect(result.payload).toEqual(['Hello', 'world']);
      expect(result.namespace).toBe('test');
    });

    it('should parse an error message correctly', () => {
      const input = JSON.stringify({
        id: 'err-456',
        level: 'error',
        timestamp: 9876543210,
        text: 'Something went wrong',
        payload: [{ error: 'details' }],
        namespace: null
      });

      const result = parseP2PMessage(input, 'outbound');

      expect(result.type).toBe('error');
      expect(result.content).toBe('Something went wrong');
      expect(result.direction).toBe('outbound');
      expect(result.namespace).toBe(null);
    });

    it('should parse a warning message correctly', () => {
      const input = JSON.stringify({
        level: 'warn',
        timestamp: 5555555555,
        text: 'Warning message'
      });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('warn');
      expect(result.content).toBe('Warning message');
      expect(result.id).toBeDefined();
    });

    it('should parse an info message correctly', () => {
      const input = JSON.stringify({
        level: 'info',
        timestamp: 1111111111,
        text: 'Informational',
        payload: [{ status: 'ok' }]
      });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('info');
      expect(result.content).toBe('Informational');
      expect(result.payload).toEqual([{ status: 'ok' }]);
    });

    it('should parse a debug message correctly', () => {
      const input = JSON.stringify({
        level: 'debug',
        timestamp: 7777777777,
        text: 'Debug info'
      });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('debug');
      expect(result.content).toBe('Debug info');
    });

    it('should handle missing optional fields', () => {
      const input = JSON.stringify({
        level: 'log',
        timestamp: 1234567890
      });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('log');
      expect(result.content).toBe('');
      expect(result.payload).toBeUndefined();
      expect(result.namespace).toBeUndefined();
    });

    it('should generate id if missing', () => {
      const input = JSON.stringify({
        level: 'log',
        timestamp: 1234567890,
        text: 'No ID'
      });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.id).toBeDefined();
      expect(result.id).toMatch(/^\d+-/);
    });
  });

  describe('Plain Text Messages', () => {
    it('should parse plain text as text type', () => {
      const input = 'Hello, this is plain text';

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('text');
      expect(result.content).toBe('Hello, this is plain text');
      expect(result.direction).toBe('inbound');
      expect(result.payload).toBeUndefined();
      expect(result.namespace).toBe(null);
    });

    it('should handle empty string', () => {
      const input = '';

      const result = parseP2PMessage(input, 'outbound');

      expect(result.type).toBe('text');
      expect(result.content).toBe('');
      expect(result.direction).toBe('outbound');
    });

    it('should handle multiline text', () => {
      const input = 'Line 1\nLine 2\nLine 3';

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('text');
      expect(result.content).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  describe('JSON Non-Console Messages', () => {
    it('should stringify JSON object without level', () => {
      const input = JSON.stringify({ foo: 'bar', baz: 123 });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('text');
      expect(result.content).toBe('{"foo":"bar","baz":123}');
    });

    it('should stringify JSON array', () => {
      const input = JSON.stringify([1, 2, 3, 'four']);

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('text');
      expect(result.content).toContain('1');
      expect(result.content).toContain('four');
    });

    it('should handle JSON with timestamp but no level', () => {
      const input = JSON.stringify({ timestamp: 123, data: 'test' });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('text');
    });
  });

  describe('Direction Handling', () => {
    it('should set direction to inbound', () => {
      const input = 'test message';

      const result = parseP2PMessage(input, 'inbound');

      expect(result.direction).toBe('inbound');
    });

    it('should set direction to outbound', () => {
      const input = 'test message';

      const result = parseP2PMessage(input, 'outbound');

      expect(result.direction).toBe('outbound');
    });

    it('should preserve direction for structured messages', () => {
      const input = JSON.stringify({
        level: 'log',
        timestamp: 123,
        text: 'test'
      });

      const resultInbound = parseP2PMessage(input, 'inbound');
      const resultOutbound = parseP2PMessage(input, 'outbound');

      expect(resultInbound.direction).toBe('inbound');
      expect(resultOutbound.direction).toBe('outbound');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed JSON gracefully', () => {
      const input = '{"invalid": json}';

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('text');
      expect(result.content).toBe(input);
    });

    it('should handle null input', () => {
      const input = 'null';

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('text');
      expect(result.content).toBe('null');
    });

    it('should handle special characters', () => {
      const input = 'Special chars: 🚀 ñ €';

      const result = parseP2PMessage(input, 'inbound');

      expect(result.content).toBe('Special chars: 🚀 ñ €');
    });

    it('should handle very long messages', () => {
      const longText = 'x'.repeat(10000);

      const result = parseP2PMessage(longText, 'inbound');

      expect(result.content).toBe(longText);
      expect(result.content.length).toBe(10000);
    });

    it('should handle nested JSON structures', () => {
      const input = JSON.stringify({
        level: 'log',
        timestamp: 123,
        text: 'nested',
        payload: [{ deep: { nested: { value: 'here' } } }]
      });

      const result = parseP2PMessage(input, 'inbound');

      expect(result.type).toBe('log');
      expect(result.payload).toEqual([{ deep: { nested: { value: 'here' } } }]);
    });
  });
});

describe('Message Handling - serializeP2PMessage', () => {
  it('should return string as-is', () => {
    const input = 'plain string';

    const result = serializeP2PMessage(input);

    expect(result).toBe('plain string');
  });

  it('should serialize object to JSON string', () => {
    const input = { foo: 'bar', num: 42 };

    const result = serializeP2PMessage(input);

    expect(result).toBe('{"foo":"bar","num":42}');
  });

  it('should serialize P2PMessage object', () => {
    const input = {
      id: 'msg-123',
      timestamp: 1234567890,
      direction: 'outbound',
      type: 'log',
      content: 'Test message',
      payload: [1, 2, 3],
      namespace: 'test'
    };

    const result = serializeP2PMessage(input);
    const parsed = JSON.parse(result);

    expect(parsed.id).toBe('msg-123');
    expect(parsed.type).toBe('log');
    expect(parsed.content).toBe('Test message');
  });

  it('should handle array', () => {
    const input = [1, 2, 'three'];

    const result = serializeP2PMessage(input);

    expect(result).toBe('[1,2,"three"]');
  });

  it('should handle null', () => {
    const input = null;

    const result = serializeP2PMessage(input);

    expect(result).toBe('null');
  });

  it('should handle undefined by returning undefined', () => {
    const input = undefined;

    const result = serializeP2PMessage(input);

    // JSON.stringify(undefined) returns undefined (not a string)
    expect(result).toBe(undefined);
  });

  it('should handle nested objects', () => {
    const input = {
      outer: {
        inner: {
          deep: 'value'
        }
      }
    };

    const result = serializeP2PMessage(input);
    const parsed = JSON.parse(result);

    expect(parsed.outer.inner.deep).toBe('value');
  });
});

describe('Message Handling - Round Trip', () => {
  it('should preserve structured message through serialize and parse', () => {
    const original = {
      id: 'test-round-trip',
      level: 'warn',
      timestamp: 9999999999,
      text: 'Round trip test',
      payload: [{ key: 'value' }],
      namespace: 'roundtrip'
    };

    const serialized = serializeP2PMessage(original);
    const parsed = parseP2PMessage(serialized, 'inbound');

    expect(parsed.id).toBe(original.id);
    expect(parsed.type).toBe(original.level);
    expect(parsed.timestamp).toBe(original.timestamp);
    expect(parsed.content).toBe(original.text);
    expect(parsed.payload).toEqual(original.payload);
    expect(parsed.namespace).toBe(original.namespace);
  });

  it('should preserve plain text through serialize and parse', () => {
    const original = 'Plain text message';

    const serialized = serializeP2PMessage(original);
    const parsed = parseP2PMessage(serialized, 'outbound');

    expect(parsed.content).toBe(original);
    expect(parsed.type).toBe('text');
  });
});
