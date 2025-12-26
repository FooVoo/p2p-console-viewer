# p2p-console-viewer-lib

A JavaScript library for establishing peer-to-peer connections and viewing console logs remotely via WebRTC and WebSocket signaling.

## Overview

`p2p-console-viewer-lib` provides a set of utilities to create P2P connections between peers using WebRTC, with WebSocket-based signaling for connection establishment.  It includes console patching capabilities to intercept and transmit console output over the P2P connection.

## Version

Current version: **0.0.3**

## Features

- **WebSocket Connector**: Establish WebSocket connections for signaling
- **P2P Signaling Client**: Handle WebRTC signaling for peer discovery and connection
- **P2P Connection**: Manage WebRTC data channels for peer-to-peer communication
- **Console Patch**: Intercept console methods (log, warn, error, etc.) and transmit output
- **Message Helper**: Utilities for formatting and handling P2P messages

## Installation

```bash
npm install p2p-console-viewer-lib
```

## Usage

```javascript
import {
  WebSocketConnector,
  P2PConnection,
  P2PSignalingClient,
  patchConsole,
  MessageHelper
} from 'p2p-console-viewer-lib';

// Example usage:
// 1. Create WebSocket connection
const ws = new WebSocketConnector('ws://your-signaling-server.com');

// 2. Initialize P2P signaling client
const signalingClient = new P2PSignalingClient(ws);

// 3. Create P2P connection
const p2pConnection = new P2PConnection(signalingClient);

// 4. Patch console to send logs over P2P
patchConsole(p2pConnection);
```

## Project Structure

```
workplaces/p2p-console-viewer-lib/
├── src/
│   ├── console-patch.js          # Console interception utilities
│   ├── p2p-connection.js         # WebRTC peer connection management
│   ├── p2p-signaling-client.js   # Signaling protocol implementation
│   ├── websocket-connector.js    # WebSocket connection wrapper
│   ├── p2p-message-helper.js     # Message formatting utilities
│   ├── public-api.js             # Main library exports
│   ├── p2p-flow-chart.md        # Architecture documentation
│   └── examples/                 # Usage examples
├── types/                         # TypeScript declarations (auto-generated)
├── public/                        # Public assets
├── package.json
└── index.html                     # Demo page
```

## Scripts

- `npm run dev` - Start development server with hot reload (exposed on network)
- `npm run build` - Build the library for production
- `npm run type-gen` - Generate TypeScript type declarations
- `npm run preview` - Preview the production build

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

### WebSocketConnector
Manages WebSocket connections for signaling.

### P2PConnection
Handles WebRTC peer connections and data channels.

### P2PSignalingClient
Implements the signaling protocol for peer discovery and connection establishment.

### patchConsole()
Patches native console methods to intercept and transmit logs.

### MessageHelper
Provides utilities for formatting and processing messages sent over the P2P connection.

## Architecture

For detailed information about the P2P connection flow, see [p2p-flow-chart.md](src/p2p-flow-chart.md).

## License

Private package - see package.json

## Notes

- This is a private package and not intended for public npm registry
- The package includes bundled `.tgz` file for local installation
- Type definitions are auto-generated during the prepack phase
