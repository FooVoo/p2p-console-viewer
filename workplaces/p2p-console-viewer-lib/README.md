# p2p-console-viewer-lib

A JavaScript library for establishing peer-to-peer connections and viewing console logs remotely via WebRTC and WebSocket signaling.

## Overview

`p2p-console-viewer-lib` provides a set of utilities to create P2P connections between peers using WebRTC, with WebSocket-based signaling for connection establishment.  It includes console patching capabilities to intercept and transmit console output over the P2P connection.

## Version

Current version: **0.0.3**

## Features

- **WebSocket Connector**: Establish WebSocket connections for signaling with automatic reconnection
- **P2P Signaling Client**: Handle WebRTC signaling for peer discovery and connection with room support
- **P2P Connection**: Manage WebRTC data channels for peer-to-peer communication
- **Room-based Isolation**: Join rooms to isolate P2P connections between specific groups of peers
- **Peer Discovery**: Automatically discover other peers in the same room
- **Graceful Error Handling**: Comprehensive error handling with `onError` and `onPeerError` handlers
- **Console Patch**: Intercept console methods (log, warn, error, etc.) and transmit output
- **Message Helper**: Utilities for formatting and handling P2P messages
- **Comprehensive Test Coverage**: 201 tests covering all library functionality and edge cases

## Installation

```bash
npm install p2p-console-viewer-lib
```

## Usage

### Basic Usage with Room Support

```javascript
import { P2PSignalingClient, patchConsole } from 'p2p-console-viewer-lib';

// Connect to signaling server and join a room
const signalingClient = new P2PSignalingClient('ws://localhost:3000', {
  room: 'my-room'
});

// Set up error handlers for graceful error handling
signalingClient.onError((error) => {
  console.error('Client error:', error.message);
});

signalingClient.onPeerError((peerId, error) => {
  console.error(`Error with peer ${peerId}:`, error.message);
});

signalingClient.connect();

// Patch console to send logs over P2P
patchConsole(signalingClient);

// All console output will be transmitted to peers in the same room
console.log('Hello from my application!');
```

### Join Room After Connection

```javascript
import { P2PSignalingClient } from 'p2p-console-viewer-lib';

const client = new P2PSignalingClient('ws://localhost:3000');
client.connect();

// Join a room after connecting
client.whenConnected(() => {
  client.joinRoom('my-room');
});
```

### Discover and Connect to Peers

```javascript
import { P2PSignalingClient } from 'p2p-console-viewer-lib';

const client = new P2PSignalingClient('ws://localhost:3000', {
  room: 'collaboration-room'
});

client.connect();

client.whenConnected(() => {
  // Get list of peers in the room
  const peers = client.getRoomPeers();
  
  if (peers.length > 0) {
    // Initiate P2P connection with first peer
    const remotePeerId = peers[0];
    client.initiateP2P(remotePeerId).then(() => {
      console.log('P2P connection initiated with', remotePeerId);
    });
  }
});
```

### Switch Between Rooms

```javascript
import { P2PSignalingClient } from 'p2p-console-viewer-lib';

const client = new P2PSignalingClient('ws://localhost:3000');
client.connect();

client.whenConnected(() => {
  // Join first room
  client.joinRoom('room-1');
  
  // Later, switch to another room
  setTimeout(() => {
    client.leaveRoom();
    client.joinRoom('room-2');
  }, 5000);
});
```

## Project Structure

```
workplaces/p2p-console-viewer-lib/
├── src/
│   ├── console-patch.js          # Console interception utilities
│   ├── p2p-connection.js         # WebRTC peer connection management
│   ├── p2p-signaling-client.js   # Signaling protocol with error handling
│   ├── websocket-connector.js    # WebSocket connection wrapper
│   ├── p2p-message-helper.js     # Message formatting utilities
│   ├── public-api.js             # Main library exports
│   ├── p2p-flow-chart.md        # Architecture documentation
│   └── examples/                 # Usage examples
├── types/                         # TypeScript declarations (auto-generated)
├── public/                        # Public assets
├── package.json
└── index.html                     # Demo page

# Tests are located in the root test/ directory
../../test/lib/                    # 221 comprehensive tests
├── websocket-connector.test.js
├── websocket-connector-edge-cases.test.js
├── p2p-signaling-client.test.js
├── p2p-signaling-client-edge-cases.test.js
├── p2p-connection.test.js
├── console-patch.test.js
└── p2p-message-helper.test.js
```

## Scripts

- `npm run dev` - Start development server with hot reload (exposed on network)
- `npm run build` - Build the library for production
- `npm run type-gen` - Generate TypeScript type declarations
- `npm run preview` - Preview the production build

## Testing

Tests are located in the root `test/lib/` directory. To run tests:

```bash
# From the repository root
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

**Test Coverage**: 201 tests covering:
- WebSocketConnector (46 tests): Connection lifecycle, message handling, edge cases
- P2PSignalingClient (61 tests): Room management, signaling, error handling, edge cases
- P2PConnection (36 tests): WebRTC lifecycle, data channels
- ConsoleInterceptor (18 tests): Console patching, callbacks
- P2pMessageHelper (40 tests): Message formatting, serialization
- Error handling: Input validation, async errors, callback protection

## Development

To work on this library:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Generate TypeScript types
npm run type-gen

# Build for production
npm run build
```

## Dependencies

- **cors** (^2.8.5) - CORS middleware
- **express** (^5.2.1) - Web server framework
- **ws** (^8.18.3) - WebSocket implementation
- **uuid** (^13.0.0) - UUID generation

## API Documentation

### P2PSignalingClient

Main client for WebRTC signaling with room support.

#### Constructor

```javascript
new P2PSignalingClient(signalingServerUrl, options)
```

**Parameters:**
- `signalingServerUrl` (string): WebSocket URL of the signaling server
- `options` (object, optional):
  - `room` (string): Room name to join on connection

**Example:**
```javascript
const client = new P2PSignalingClient('ws://localhost:3000', {
  room: 'my-room'
});
```

#### Methods

##### `connect()`
Opens the WebSocket connection to the signaling server.

##### `joinRoom(roomName)`
Join a specific room on the signaling server.
- `roomName` (string): Name of the room to join (validated: must be non-empty string)
- Returns: `boolean` - True if request sent successfully, false on validation failure

##### `leaveRoom()`
Leave the current room.
- Returns: `boolean` - True if request sent successfully, false if not in a room

##### `getRoomPeers()`
Get the list of peer IDs in the current room.
- Returns: `Array<string>` - Array of peer IDs

##### `initiateP2P(remotePeerId)`
Initiate a P2P connection to a specific remote peer.
- `remotePeerId` (string): ID of the peer to connect to (validated: must be non-empty string)
- Returns: `Promise<Object>` - Resolves with the SDP offer, rejects on error

##### `sendMessage(remotePeerId, message)`
Send a message over the P2P data channel.
- `remotePeerId` (string): Target peer ID
- `message` (string|Object): Message to send
- Returns: `boolean` - True if sent successfully

##### `disconnect()`
Close all P2P connections and the signaling WebSocket.

##### `whenConnected(callback)`
Register a callback to be executed when the signaling WebSocket is ready.
- `callback` (Function): Called when connected (errors in callback are caught and emitted)

##### `onError(handler)`
Register a handler for general errors (WebSocket, server, validation errors).
- `handler` (Function): Called with error object: `(error) => { ... }`

**Example:**
```javascript
client.onError((error) => {
  console.error('Client error:', error.message);
  // Handle WebSocket errors, server errors, validation errors
});
```

##### `onPeerError(handler)`
Register a handler for peer-specific connection errors.
- `handler` (Function): Called with peer ID and error: `(peerId, error) => { ... }`

**Example:**
```javascript
client.onPeerError((peerId, error) => {
  console.error(`Error with peer ${peerId}:`, error.message);
  // Handle WebRTC connection failures, signaling errors for specific peers
});
```

### P2PConnection

Handles WebRTC peer connections and data channels.

#### Methods

##### `initiate()`
Initialize as the connection initiator (creates offer).
- Returns: `Promise<RTCSessionDescriptionInit>` - The created SDP offer

##### `receiveOffer(offer)`
Initialize as the connection receiver (receives offer, creates answer).
- `offer` (RTCSessionDescriptionInit): Remote SDP offer
- Returns: `Promise<RTCSessionDescriptionInit>` - The created SDP answer

##### `send(message)`
Send a message through the data channel.
- `message` (string|Object): Message to send
- Returns: `boolean` - True if sent successfully

##### `close()`
Close the connection and cleanup resources.

##### `isConnected()`
Check if connection is established and data channel is open.
- Returns: `boolean`

### WebSocketConnector

Lightweight wrapper around the browser WebSocket API.

#### Methods

##### `connect()`
Open the WebSocket connection.

##### `send(message)`
Send a message over the WebSocket.
- `message` (string|Object): Message to send
- Returns: `boolean` - True if sent successfully

##### `disconnect(preventReconnect)`
Close the WebSocket connection.
- `preventReconnect` (boolean): If true, stops automatic reconnection

##### `onMessage(handler)`
Register a handler for incoming messages.
- `handler` (Function): Called with message data

##### `whenReady(callback)`
Run a callback when the WebSocket is open and ready.
- `callback` (Function): Called when ready

## Architecture

For detailed information about the P2P connection flow, see [p2p-flow-chart.md](src/p2p-flow-chart.md).

## License

Private package - see package.json

## Notes

- This is a private package and not intended for public npm registry
- The package includes bundled `.tgz` file for local installation
- Type definitions are auto-generated during the prepack phase
