# Test Suite - Server Tests

This directory contains unit tests for the p2p-console-viewer-server signaling server.

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

- `server-logic.test.js` - Unit tests for room management and message routing logic

## Test Coverage

The test suite covers:

- Room management logic (create, join, leave, cleanup)
- Client management (tracking clients and their rooms)
- Message routing logic (same room vs. different rooms)
- Protocol message structures (ID assignment, room events, peer notifications)
- Broadcast target selection

## Writing Tests

Tests are written using [Vitest](https://vitest.dev/). Follow these guidelines:

1. Use descriptive test names that explain what is being tested
2. Group related tests using `describe` blocks
3. Focus on testing logic rather than integration (use mocks for WebSocket)
4. Test both success and error cases
5. Verify message structure and protocol compliance
