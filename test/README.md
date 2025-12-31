# Test Suite

Comprehensive unit tests for the p2p-console-viewer project using [Vitest](https://vitest.dev/).

## Overview

The test suite provides complete coverage of both the P2P library and signaling server with **250 tests** covering normal operation, edge cases, and error handling scenarios.

## Structure

```
test/
├── lib/              # Tests for p2p-console-viewer-lib (201 tests)
│   ├── websocket-connector.test.js           # Connection lifecycle (24 tests)
│   ├── websocket-connector-edge-cases.test.js # Edge cases (28 tests)
│   ├── p2p-signaling-client.test.js          # Signaling + room management (28 tests)
│   ├── p2p-signaling-client-edge-cases.test.js # Edge cases + error handling (47 tests)
│   ├── p2p-connection.test.js                # WebRTC connections (39 tests)
│   ├── console-patch.test.js                 # Console interception (30 tests)
│   ├── p2p-message-helper.test.js            # Message formatting (25 tests)
│   └── README.md
└── server/           # Tests for p2p-console-viewer-server (49 tests)
    ├── server-logic.test.js                  # Room management + routing (18 tests)
    ├── server-edge-cases.test.js             # Edge cases (13 tests)
    └── README.md
```

## Running Tests

All tests are run from the root directory:

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Statistics

- **Total Tests**: 250
  - Library tests: 201
    - WebSocketConnector: 46 (24 base + 22 edge cases)
    - P2PSignalingClient: 61 (28 base + 33 edge cases)
    - P2PConnection: 36
    - ConsoleInterceptor: 18
    - P2pMessageHelper: 40
  - Server tests: 49 (18 base + 31 edge cases)

## Coverage

The test suite provides comprehensive coverage of:

### Library (`p2p-console-viewer-lib`)
- **WebSocket connection management**: Lifecycle, reconnection, message handling
- **P2P signaling protocol**: Room management, peer discovery, signaling routing
- **Error handling**: Input validation, async operation errors, callback protection
- **Edge cases**: Extreme inputs, rapid operations, unicode/emoji, boundary conditions
- **WebRTC connections**: Offer/answer exchange, ICE candidates, data channels
- **Console patching**: Method interception, callback invocation, unpatch behavior
- **Message formatting**: Building, serialization, console wrapping

### Server (`p2p-console-viewer-server`)
- **Room management**: Creation, joining, leaving, cleanup
- **Client tracking**: State management across connections
- **Message routing**: Same room vs. different rooms, broadcast logic
- **Protocol messages**: ID assignment, room events, peer notifications
- **Edge cases**: Extreme inputs, boundary conditions, concurrent operations

## Configuration

Tests are configured via `vitest.config.js` in the root directory. Key settings:

- **Environment**: Node.js
- **Coverage Provider**: v8
- **Coverage Reports**: text, JSON, HTML
- **Test Files**: `test/**/*.test.js`
- **Test Isolation**: Each test runs in isolation with proper setup/teardown

## Writing New Tests

1. Create test files in the appropriate directory (`test/lib/` or `test/server/`)
2. Follow the naming convention: `*.test.js` or `*-edge-cases.test.js`
3. Use descriptive test names and group related tests with `describe`
4. Mock external dependencies where appropriate (WebSocket, RTCPeerConnection)
5. Test both success paths and error cases
6. Include edge cases: boundary conditions, invalid inputs, extreme values

### Example Test Structure

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('FeatureName', () => {
  describe('normal operation', () => {
    it('should handle typical scenario', () => {
      // Test code
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      // Test code
    });
  });

  describe('error handling', () => {
    it('should emit error on failure', () => {
      // Test code
    });
  });
});
```

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Commits to pull requests
- Merges to main branch

All tests must pass before code can be merged.

## Test Reports

After running tests with coverage:
- **Console output**: Summary in terminal
- **HTML report**: `coverage/index.html` (open in browser)
- **JSON report**: `coverage/coverage-final.json` (for CI tools)
