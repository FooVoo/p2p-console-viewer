# Test Suite - Server Tests

This directory contains unit tests for the p2p-console-viewer-server signaling server.

## Test Files

- `server-logic.test.js` (18 tests) - Core room management and message routing logic
- `server-edge-cases.test.js` (31 tests) - Edge cases, boundary conditions, and extreme inputs

**Total**: 49 tests

## Running Tests

From the root directory:

```bash
# Run all tests (including lib and server)
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run only server tests (if you have filtering enabled)
npm test -- test/server
```

## Test Coverage

The test suite covers:

### Core Functionality (18 tests)
- **Room management**: Create, join, leave, automatic cleanup
- **Client tracking**: Adding/removing clients, room associations
- **Message routing**: Same room vs. different rooms, target validation
- **Protocol messages**: ID assignment, room events, peer notifications
- **Broadcast logic**: Selecting correct recipients for messages

### Edge Cases (31 tests)
- **Extreme inputs**: Very long room names, thousands of clients
- **Boundary conditions**: Empty rooms, single client scenarios
- **Unicode support**: International characters, emojis in room names
- **Malformed input**: Invalid target IDs, missing required fields
- **Concurrent operations**: Rapid join/leave, simultaneous connections
- **Large payloads**: Big messages, extensive room lists
- **Status endpoint**: Extreme data scenarios

## Writing Tests

Tests are written using [Vitest](https://vitest.dev/). Follow these guidelines:

1. Use descriptive test names that explain what is being tested
2. Group related tests using `describe` blocks
3. Focus on testing logic rather than integration (use mocks for WebSocket)
4. Test both success and error cases
5. Verify message structure and protocol compliance

### Example Test Structure

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { createRoom, addClientToRoom, removeClientFromRoom } from '../server-helpers';

describe('Room Management', () => {
  let rooms;
  let clients;

  beforeEach(() => {
    rooms = new Map();
    clients = new Map();
  });

  describe('edge cases', () => {
    it('should handle very long room names', () => {
      const longName = 'a'.repeat(10000);
      const result = createRoom(rooms, longName);
      
      expect(result).toBe(true);
      expect(rooms.has(longName)).toBe(true);
    });

    it('should handle thousands of clients in one room', () => {
      const roomName = 'stress-test';
      createRoom(rooms, roomName);
      
      for (let i = 0; i < 1000; i++) {
        addClientToRoom(rooms, clients, `client-${i}`, roomName);
      }
      
      expect(rooms.get(roomName).size).toBe(1000);
    });
  });
});
```

## Test Strategy

### Unit Testing Approach
- Tests focus on the logic extracted into testable functions
- WebSocket connections are mocked to isolate business logic
- Room state and client maps are tested directly
- Message routing decisions are verified without network I/O

### Coverage Areas
1. **Room Lifecycle**: Creation, population, cleanup
2. **Client State**: Tracking room membership, handling disconnects
3. **Routing Logic**: Determining message recipients, filtering by room
4. **Protocol Compliance**: Message structure, required fields
5. **Edge Cases**: Extreme values, boundary conditions, error scenarios

## Mocking Strategy

- **WebSocket objects**: Mock `send()` method to verify message transmission
- **Client state**: Use in-memory Maps to simulate server state
- **Message parsing**: Test JSON serialization/deserialization

## Coverage Goals

- All room management operations tested
- All message routing paths verified
- Edge cases and boundary conditions covered
- Protocol message formats validated
- Error handling and invalid inputs tested
