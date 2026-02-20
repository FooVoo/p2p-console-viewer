# Test Suite - Library Tests

This directory contains unit tests for the p2p-console-viewer-lib library.

## Test Files

### Core Functionality
- `websocket-connector.test.js` (24 tests) - WebSocket connection management
- `p2p-signaling-client.test.js` (28 tests) - P2P signaling client with room support
- `p2p-connection.test.js` (36 tests) - WebRTC peer connections and data channels
- `console-patch.test.js` (18 tests) - Console method interception
- `p2p-message-helper.test.js` (40 tests) - Message formatting and serialization

### Edge Cases & Error Handling
- `websocket-connector-edge-cases.test.js` (22 tests) - Extreme inputs, rapid operations, race conditions
- `p2p-signaling-client-edge-cases.test.js` (33 tests) - Edge cases, concurrent operations, error handling

**Total**: 201 tests

## Running Tests

From the root directory:

```bash
# Run all tests (including lib and server)
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run only library tests (if you have filtering enabled)
npm test -- test/lib
```

## Test Coverage

The test suite covers:

### WebSocketConnector (46 tests)
- Connection lifecycle (connect, disconnect, reconnect)
- Message sending and receiving
- Handler registration and callbacks
- Automatic reconnection logic
- Edge cases: Extreme message sizes, rapid operations, invalid states
- Unicode and emoji support

### P2PSignalingClient (61 tests)
- Room management (join, leave, peer discovery)
- Signaling message routing (offer, answer, ICE candidates)
- P2P connection initiation and lifecycle
- Error event system (`onError`, `onPeerError`)
- Input validation (peer IDs, room names)
- Async operation error handling
- Callback protection and error boundaries
- Edge cases: Very long names, special characters, concurrent operations
- Malformed message handling

### P2PConnection (36 tests)
- WebRTC connection establishment
- Offer/answer exchange (initiator and receiver roles)
- ICE candidate handling
- Data channel creation and messaging
- Connection state management
- Error handling and cleanup

### ConsoleInterceptor (18 tests)
- Console method patching (log, warn, error, info, debug)
- Callback invocation with correct arguments
- Multiple handler support
- Unpatch functionality and restoration
- Original console preservation

### P2pMessageHelper (40 tests)
- Message object building
- Console method wrapping
- Serialization and deserialization
- Message type handling
- Error cases

## Writing Tests

Tests are written using [Vitest](https://vitest.dev/). Follow these guidelines:

1. Use descriptive test names that explain what is being tested
2. Group related tests using `describe` blocks
3. Use `beforeEach`/`afterEach` for setup and teardown
4. Mock external dependencies (WebSocket, RTCPeerConnection)
5. Test both success and error cases
6. Include edge cases for boundary conditions

### Example Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('P2PSignalingClient', () => {
  let client;
  let mockWebSocket;

  beforeEach(() => {
    // Setup
    mockWebSocket = createMockWebSocket();
    client = new P2PSignalingClient('ws://test', {});
  });

  afterEach(() => {
    // Cleanup
    client?.disconnect();
  });

  describe('error handling', () => {
    it('should emit error for invalid peer ID', async () => {
      const errorHandler = vi.fn();
      client.onError(errorHandler);
      
      await expect(client.initiateP2P('')).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });
  });
});
```

## Mocking Strategy

- **WebSocket**: Mock using Vitest's `vi.fn()` to simulate connection states
- **RTCPeerConnection**: Mock WebRTC API to test connection logic
- **Timers**: Use `vi.useFakeTimers()` for testing time-dependent behavior

## Coverage Goals

- All public methods should have tests
- Critical error paths should be tested
- Edge cases and boundary conditions should be covered
- Integration between components should be validated
