# P2PSignalingClient Error Handling Improvements

## Overview
Enhanced the `P2PSignalingClient` class to gracefully handle errors and provide comprehensive error reporting mechanisms for applications.

## Key Improvements

### 1. Error Event System
Added two types of error handlers:
- **`onError(handler)`**: General errors (WebSocket errors, server errors, validation errors)
- **`onPeerError(handler, peerId)`**: Peer-specific connection errors

```javascript
const client = new P2PSignalingClient('ws://localhost:3000');

// Handle general errors
client.onError((error) => {
  console.error('Client error:', error.message);
});

// Handle peer-specific errors
client.onPeerError((peerId, error) => {
  console.error(`Error with peer ${peerId}:`, error.message);
});
```

### 2. WebSocket Error Handling
- Automatically registers WebSocket error handlers in constructor
- Emits errors through `onError` handlers for application-level handling
- Provides context about WebSocket failures

### 3. Async Operation Error Handling
All asynchronous WebRTC operations now properly catch and handle errors:

#### initiateP2P()
- Validates `remotePeerId` parameter (rejects null, undefined, empty string, non-string values)
- Catches and reports initiation failures
- Returns rejected Promise on error for proper error propagation

```javascript
try {
  await client.initiateP2P('peer123');
} catch (error) {
  // Error is also emitted through onError/onPeerError
  console.error('Failed to initiate connection:', error);
}
```

#### Signaling Message Handling
- `receiveOffer()`: Errors caught and reported via `onPeerError`
- `receiveAnswer()`: Errors caught and reported via `onPeerError`
- `addIceCandidate()`: Errors caught and logged (less critical)

### 4. WebSocket Send Operation Validation
All signaling operations now return boolean success indicators:

#### joinRoom(roomName)
- Validates room name (string, non-empty)
- Returns `false` if validation fails or WebSocket not ready
- Returns `true` if request successfully sent

#### leaveRoom()
- Checks if currently in a room
- Returns `false` if not in room or WebSocket not ready
- Returns `true` if request successfully sent

#### Signaling Message Forwarding
When forwarding offers, answers, and ICE candidates:
- Checks WebSocket send success
- Emits peer error if critical messages (offer/answer) fail to send
- Logs warnings for ICE candidate send failures (less critical)

### 5. Server Error Message Handling
Added support for server-side error messages:
```json
{ "type": "error", "message": "Room not found" }
```
These errors are emitted through the `onError` handler.

### 6. Callback Error Protection
`whenConnected()` callbacks are now wrapped in try-catch:
- Errors in user callbacks don't crash the application
- Errors are logged and emitted through `onError`
- Other callbacks continue to execute

### 7. Peer Connection Error Resilience
Added `onDisconnected()` handler registration for all P2P connections to track connection lifecycle and enable cleanup.

## Error Handling Patterns

### Pattern 1: Validation Errors
```javascript
try {
  await client.initiateP2P(invalidPeerId);
} catch (error) {
  // error.message: "Valid remotePeerId is required"
}
```

### Pattern 2: WebRTC Errors
```javascript
client.onPeerError((peerId, error) => {
  // Handle failures in offer/answer exchange
  // Consider retry logic or user notification
});
```

### Pattern 3: Server Errors
```javascript
client.onError((error) => {
  if (error.message.includes('Room not found')) {
    // Handle room-specific errors
  }
});
```

### Pattern 4: WebSocket Errors
```javascript
client.onError((error) => {
  if (error.message.startsWith('WebSocket error:')) {
    // Handle connection issues
    // Consider reconnection logic
  }
});
```

## Error Handler Safety
All error handler invocations are wrapped in try-catch blocks to prevent errors in error handlers from cascading:

```javascript
emitError(error) {
  this.onErrorHandlers.forEach((handler) => {
    try {
      handler(error);
    } catch (e) {
      console.error("Error in error handler:", e);
    }
  });
}
```

## Backward Compatibility
All changes are backward compatible:
- Existing code continues to work without modification
- Error handlers are optional
- Console logging remains for debugging
- Return values added where previously `void` (non-breaking change)

## Test Coverage
Added 11 new tests specifically for error handling scenarios:
- Error event emission
- Peer error emission
- Error handler exception safety
- Server error message handling
- Invalid parameter validation
- WebSocket send failures
- Callback error handling

Total test coverage: 250 tests (all passing)
