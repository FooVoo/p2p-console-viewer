# Console Viewer Tests

This directory contains tests for the P2P Console Viewer application message handling functionality.

## Test Files

### message-handling.test.js (30 tests)

Tests for the message parsing, serialization, and type preservation system that enables proper structured message handling in the console viewer.

#### Test Categories

**Structured Console Messages (7 tests)**
- Parsing log, info, warn, error, and debug messages
- Handling missing optional fields (id, namespace, payload)
- Auto-generating IDs when missing

**Plain Text Messages (3 tests)**
- Parsing plain text as 'text' type
- Handling empty strings
- Multiline text support

**JSON Non-Console Messages (3 tests)**
- Stringifying arbitrary JSON objects
- Handling JSON arrays
- Differentiating from structured console messages

**Direction Handling (3 tests)**
- Setting inbound direction
- Setting outbound direction
- Preserving direction for structured messages

**Edge Cases (8 tests)**
- Malformed JSON graceful handling
- Null input handling
- Special characters (unicode, emoji)
- Very long messages (10,000 characters)
- Nested JSON structures

**Serialization (7 tests)**
- String pass-through
- Object serialization to JSON
- P2PMessage object serialization
- Array handling
- Null/undefined handling
- Nested object serialization

**Round Trip (2 tests)**
- Structured message preservation through serialize → parse cycle
- Plain text message preservation through serialize → parse cycle

## Running Tests

From the repository root:

```bash
# Run all console viewer tests
npm test test/console

# Run specific test file
npm test test/console/message-handling.test.js

# Run tests in watch mode
npm run test:watch test/console

# Generate coverage report
npm run test:coverage -- test/console
```

## Test Philosophy

These tests focus on:

1. **Type Preservation**: Ensuring console message types (log/info/warn/error/debug) are preserved through transmission
2. **Direction Tracking**: Verifying inbound vs outbound messages are correctly labeled
3. **Backward Compatibility**: Supporting both structured (P2pMessageHelper) and plain text messages
4. **Edge Case Resilience**: Handling malformed input, extreme values, and special characters gracefully
5. **Round-Trip Integrity**: Ensuring data survives serialization → transmission → deserialization

## Integration with P2P Library

The message handling functions tested here integrate with:

- **P2pMessageHelper**: Creates structured console messages with type, timestamp, payload
- **P2PConnection**: Transmits serialized messages over WebRTC data channels
- **Console Viewer UI**: Displays messages with type-specific styling and metadata

## Message Structure

All parsed messages conform to the P2PMessage interface:

```typescript
interface P2PMessage {
  id: string;                                    // Unique identifier
  timestamp: number;                             // Unix timestamp (ms)
  direction: 'inbound' | 'outbound';            // Message flow direction
  type: 'log'|'info'|'warn'|'error'|'debug'|'text'; // Message type
  content: string;                               // Human-readable content
  payload?: any[];                               // Optional structured data
  namespace?: string | null;                     // Optional message grouping
}
```

## Coverage

Current test coverage: **100%** of message handling functions

Functions covered:
- `parseP2PMessage(data, direction)` - Parse incoming messages
- `serializeP2PMessage(message)` - Serialize outgoing messages

## Future Test Additions

Potential areas for expansion:

- Message filtering logic tests
- Message search functionality tests
- Export/import functionality tests
- Real WebSocket integration tests
- Performance tests with thousands of messages
- Message batching/throttling tests
