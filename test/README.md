# Test Suite

Comprehensive unit tests for the p2p-console-viewer project using [Vitest](https://vitest.dev/).

## Structure

```
test/
├── lib/              # Tests for p2p-console-viewer-lib
│   ├── websocket-connector.test.js
│   ├── p2p-signaling-client.test.js
│   └── README.md
└── server/           # Tests for p2p-console-viewer-server
    ├── server-logic.test.js
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

- **Total Tests**: 70
  - Library tests: 52 (WebSocketConnector: 24, P2PSignalingClient: 28)
  - Server tests: 18 (Room management and protocol logic)

## Coverage

The test suite provides comprehensive coverage of:

### Library (`p2p-console-viewer-lib`)
- WebSocket connection management and lifecycle
- P2P signaling protocol with room support
- Message routing and peer discovery
- Error handling and edge cases

### Server (`p2p-console-viewer-server`)
- Room creation, joining, and cleanup
- Client tracking and state management
- Message routing between clients in same/different rooms
- Protocol message structures and validation

## Configuration

Tests are configured via `vitest.config.js` in the root directory. Key settings:

- **Environment**: Node.js
- **Coverage Provider**: v8
- **Coverage Reports**: text, JSON, HTML
- **Test Files**: `test/**/*.test.js`

## Writing New Tests

1. Create test files in the appropriate directory (`test/lib/` or `test/server/`)
2. Follow the naming convention: `*.test.js`
3. Use descriptive test names and group related tests with `describe`
4. Mock external dependencies where appropriate
5. Test both success paths and error cases

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Commits to pull requests
- Merges to main branch

All tests must pass before code can be merged.
