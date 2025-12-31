# Test Suite - Library Tests

This directory contains unit tests for the p2p-console-viewer-lib library.

## Running Tests

From the root directory:

```bash
# Run all tests (including lib and server)
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Files

- `websocket-connector.test.js` - Tests for WebSocket connection management
- `p2p-signaling-client.test.js` - Tests for P2P signaling client with room support

## Test Coverage

The test suite covers:

- WebSocket connection lifecycle (connect, disconnect, reconnect)
- Message sending and receiving
- Handler registration and callbacks
- Room management (join, leave, peer discovery)
- Signaling message routing (offer, answer, ICE candidates)
- Error handling

## Writing Tests

Tests are written using [Vitest](https://vitest.dev/). Follow these guidelines:

1. Use descriptive test names that explain what is being tested
2. Group related tests using `describe` blocks
3. Use `beforeEach`/`afterEach` for setup and teardown
4. Mock external dependencies (WebSocket, RTCPeerConnection)
5. Test both success and error cases
