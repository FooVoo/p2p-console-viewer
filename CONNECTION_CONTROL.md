# WebSocket Connection Control Documentation

This document describes the enhanced WebSocket connection control features added to the P2P Console Viewer.

## Overview

The WebSocket connection management system now provides comprehensive control over connection lifecycle, including manual reconnection, state inspection, and auto-reconnect configuration.

## Features

### 1. Connection State Management

#### `getConnectionState()`
Returns the current WebSocket connection state.

**Returns:** `string` - One of:
- `'disconnected'` - No WebSocket instance exists
- `'connecting'` - Connection is being established
- `'open'` - Connection is active and ready
- `'closing'` - Connection is in the process of closing
- `'closed'` - Connection has been closed

**Example:**
```javascript
const client = new P2PSignalingClient('ws://localhost:3000');
console.log(client.getConnectionState()); // 'disconnected'

client.connect();
console.log(client.getConnectionState()); // 'connecting' or 'open'
```

#### `isConnected()`
Convenience method to check if the connection is currently open.

**Returns:** `boolean` - True if connection state is 'open', false otherwise

**Example:**
```javascript
if (client.isConnected()) {
  client.sendMessage('Hello!');
}
```

### 2. Manual Reconnection

#### `forceReconnect()`
Forces an immediate reconnection by closing the current connection and establishing a new one.

**Features:**
- Closes all active P2P connections
- Clears peer state
- Immediately reconnects to the signaling server
- Automatically rejoins the current room (if any)
- Preserves auto-reconnect settings

**Use Cases:**
- Recovering from network errors
- Forcing a fresh connection after suspected issues
- Manual retry after failed connection attempts

**Example:**
```javascript
// Force a fresh connection
client.forceReconnect();

// The client will:
// 1. Close all P2P connections
// 2. Disconnect from signaling server
// 3. Reconnect immediately
// 4. Rejoin the current room (if applicable)
```

### 3. Auto-Reconnect Control

#### `enableAutoReconnect()`
Enables automatic reconnection after connection loss.

**Example:**
```javascript
client.enableAutoReconnect();
```

#### `disableAutoReconnect()`
Disables automatic reconnection. Useful when intentionally disconnecting or during cleanup.

**Example:**
```javascript
client.disableAutoReconnect();
client.disconnect(); // Won't automatically reconnect
```

#### `setReconnectInterval(intervalMs)`
Sets the delay before attempting automatic reconnection.

**Parameters:**
- `intervalMs` (number) - Milliseconds to wait before reconnecting (must be > 0)

**Default:** 3000ms (3 seconds)

**Example:**
```javascript
// Wait 5 seconds before reconnecting
client.setReconnectInterval(5000);

// For testing/development: faster reconnect
client.setReconnectInterval(500);
```

## UI Integration

The console viewer includes a comprehensive connection control panel:

### Connection Status Display
- **Status Badge**: Shows current connection state with color coding
  - Gray: Disconnected/Closed
  - Yellow (pulsing): Connecting
  - Green: Open/Connected
  - Red: Closing

### Control Buttons
- **Connect**: Initiates connection to signaling server
- **Disconnect**: Closes connection (with auto-reconnect disabled by default)
- **Force Reconnect**: Triggers immediate reconnection

### Advanced Settings
Expandable panel providing:
- **Auto-reconnect Toggle**: Enable/disable automatic reconnection
- **Reconnect Interval**: Configure reconnection delay in milliseconds

## API Reference

### P2PSignalingClient Methods

```javascript
// State inspection
client.getConnectionState()  // Returns: string
client.isConnected()         // Returns: boolean

// Manual control
client.connect()             // Initiates connection
client.disconnect()          // Closes connection
client.forceReconnect()      // Forces immediate reconnection

// Auto-reconnect configuration
client.enableAutoReconnect()           // Enables auto-reconnect
client.disableAutoReconnect()          // Disables auto-reconnect
client.setReconnectInterval(ms)        // Sets reconnect delay
```

### WebSocketConnector Methods

Lower-level WebSocket control (exposed through P2PSignalingClient):

```javascript
// Direct access to WebSocketConnector (if needed)
const ws = client.ws;

ws.getConnectionState()      // Connection state
ws.isConnected()             // Boolean connection check
ws.forceReconnect()          // Force reconnection
ws.setReconnectInterval(ms)  // Set reconnect delay
ws.enableAutoReconnect()     // Enable auto-reconnect
ws.disableAutoReconnect()    // Disable auto-reconnect
```

## Error Handling

All connection control methods include error handling:

```javascript
// forceReconnect handles errors gracefully
client.forceReconnect(); // Won't throw even if connections fail to close

// Monitor connection errors
client.onError((error) => {
  console.error('Connection error:', error);
  // Optionally force reconnect
  if (client.getConnectionState() === 'closed') {
    setTimeout(() => client.forceReconnect(), 1000);
  }
});
```

## Best Practices

### 1. Use State Checking Before Operations
```javascript
if (client.isConnected()) {
  client.sendMessage('Hello');
} else {
  console.warn('Not connected, attempting reconnect...');
  client.forceReconnect();
}
```

### 2. Configure Auto-Reconnect Based on Environment
```javascript
// Production: Longer interval, always enabled
if (isProd()) {
  client.setReconnectInterval(5000);
  client.enableAutoReconnect();
}

// Development: Faster feedback, manual control
if (isDev()) {
  client.setReconnectInterval(1000);
  // Manual control for debugging
}
```

### 3. Clean Up on Application Exit
```javascript
window.addEventListener('beforeunload', () => {
  client.disableAutoReconnect();
  client.disconnect();
});
```

### 4. Handle Network Changes
```javascript
// React to network state changes
window.addEventListener('online', () => {
  console.log('Network restored');
  client.forceReconnect();
});

window.addEventListener('offline', () => {
  console.log('Network lost');
  // Auto-reconnect will handle this once network returns
});
```

## Testing

Comprehensive test coverage ensures reliability:

- **42 tests** for WebSocketConnector connection controls
- **Integration tests** for P2PSignalingClient
- **Edge case coverage**: Invalid states, errors, concurrent operations
- **UI interaction tests** for button states and settings

Run tests:
```bash
npm test test/lib/websocket-connection-controls.test.js
```

## Migration Guide

### From Previous Version

Old way:
```javascript
// Limited control
client.connect();
client.disconnect();
```

New way:
```javascript
// Full control
client.connect();

// Check state
if (client.getConnectionState() === 'open') {
  // Do something
}

// Force reconnect when needed
client.forceReconnect();

// Configure auto-reconnect
client.setReconnectInterval(3000);
client.enableAutoReconnect();

// Clean disconnect
client.disableAutoReconnect();
client.disconnect();
```

All existing code continues to work - new features are additive.

## Examples

### Example 1: Resilient Connection
```javascript
const client = new P2PSignalingClient('ws://localhost:3000');

// Enable aggressive auto-reconnect
client.enableAutoReconnect();
client.setReconnectInterval(2000);

// Monitor state
setInterval(() => {
  const state = client.getConnectionState();
  console.log('Connection state:', state);
  
  if (state === 'closed' && autoReconnectDisabled) {
    // Manual fallback
    client.forceReconnect();
  }
}, 5000);

client.connect();
```

### Example 2: Development Testing
```javascript
// Quick reconnect for testing
client.setReconnectInterval(500);

// Test button
document.getElementById('reconnect-btn').addEventListener('click', () => {
  console.log('Testing reconnection...');
  client.forceReconnect();
});

// State monitor
document.getElementById('status').textContent = client.getConnectionState();
setInterval(() => {
  document.getElementById('status').textContent = client.getConnectionState();
}, 100);
```

### Example 3: Graceful Shutdown
```javascript
async function shutdown() {
  console.log('Shutting down...');
  
  // Disable auto-reconnect first
  client.disableAutoReconnect();
  
  // Send goodbye messages to peers
  const peers = client.getRoomPeers();
  for (const peer of peers) {
    client.sendMessage(peer, { type: 'goodbye' });
  }
  
  // Wait a moment for messages to send
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Disconnect
  client.disconnect();
  
  console.log('Shutdown complete');
}
```

## Troubleshooting

### Connection Won't Reconnect
- Check if auto-reconnect is enabled: `client.ws.shouldReconnect`
- Verify reconnect interval is reasonable
- Try manual reconnect: `client.forceReconnect()`

### State Shows 'connecting' Indefinitely
- Network issue or server not responding
- Force reconnect: `client.forceReconnect()`
- Check server is running and accessible

### Reconnecting Too Frequently
- Increase reconnect interval: `client.setReconnectInterval(10000)` 
- Check for connection stability issues
- Review error logs for root cause

## Future Enhancements

Planned features:
- Exponential backoff for reconnection attempts
- Connection quality metrics
- Automatic server failover
- Connection pooling for multiple servers
