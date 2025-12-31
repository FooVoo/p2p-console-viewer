# P2P Console Viewer

A peer-to-peer console viewing system that enables real-time remote console log monitoring through WebRTC connections.  This monorepo contains both the core P2P library and a web-based console viewer application.

## 🚀 Overview

P2P Console Viewer allows you to view console output from remote applications in real-time using peer-to-peer connections. It's perfect for debugging distributed applications, monitoring IoT devices, or any scenario where you need to view console logs from remote environments without a centralized logging server.

### Key Features

- **True Peer-to-Peer**: Direct WebRTC connections between peers, no intermediary servers needed (except for initial signaling)
- **Room-based Isolation**: Group peers into rooms for organized multi-peer coordination
- **Real-time Console Streaming**: Intercepts and transmits console.log, console.warn, console.error, etc.
- **Graceful Error Handling**: Comprehensive error handling system with custom error handlers
- **Modern Web UI**: Built with Svelte 5 and Tailwind CSS for a responsive viewing experience
- **TypeScript Support**: Full type definitions for the library
- **Comprehensive Test Suite**: 250 tests with Vitest providing complete coverage
- **Monorepo Structure**: Organized workspaces for library, server, and application

## 📦 Repository Structure

```
p2p-console-viewer/
├── workplaces/
│   ├── p2p-console-viewer-lib/      # Core P2P library
│   ├── p2p-console-viewer-console/  # Web console viewer app
│   └── p2p-console-viewer-server/   # Signaling server
├── test/                             # Centralized test suite (250 tests)
│   ├── lib/                          # Library tests (201 tests)
│   └── server/                       # Server tests (49 tests)
├── package.json                      # Root workspace configuration
├── vitest.config.js                  # Unified test configuration
└── README.md                         # This file
```

## 🏗️ Projects

### 1. p2p-console-viewer-lib

A lightweight JavaScript library that provides P2P connectivity and console patching capabilities.

**Features:**
- WebSocket-based signaling client
- WebRTC peer connection management
- Console method interception
- Message formatting and transmission utilities
- Room-based peer discovery and isolation
- Graceful error handling with custom error handlers
- Comprehensive test coverage (201 tests)

**[View Documentation →](workplaces/p2p-console-viewer-lib/README.md)**

### 2. p2p-console-viewer-console

A SvelteKit web application that provides a user interface for viewing remote console logs.

**Tech Stack:**
- Svelte 5 + SvelteKit 2
- Tailwind CSS 4
- TypeScript
- Vite

**[View Documentation →](workplaces/p2p-console-viewer-console/README.md)**

### 3. p2p-console-viewer-server

A WebSocket-based signaling server for establishing WebRTC connections with room support.

**Features:**
- Room-based signaling for isolated P2P connections
- WebRTC signal routing (offers, answers, ICE candidates)
- Peer discovery within rooms
- Auto-cleanup of empty rooms
- HTTP status endpoint for monitoring
- Comprehensive test coverage (49 tests)

**[View Documentation →](workplaces/p2p-console-viewer-server/README.md)**

## 🚦 Getting Started

### Prerequisites

- Node.js v16 or higher
- npm, pnpm, or yarn

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/FooVoo/p2p-console-viewer.git
cd p2p-console-viewer
npm install
```

This will install dependencies for all workspace projects.

### Quick Start

#### 1. Start the Signaling Server

```bash
cd workplaces/p2p-console-viewer-server
npm install
npm start
```

The signaling server will be available at `http://localhost:3000`

#### 2. Build the Library

```bash
cd workplaces/p2p-console-viewer-lib
npm run build
```

#### 3. Run the Console Viewer

```bash
cd workplaces/p2p-console-viewer-console
npm run dev
```

The console viewer will be available at `http://localhost:5173`

#### 4. Integrate into Your Application

In your application that you want to monitor:

```javascript
import { P2PSignalingClient, patchConsole } from 'p2p-console-viewer-lib';

// Initialize connection with room support
const signalingClient = new P2PSignalingClient('ws://localhost:3000', {
  room: 'my-app-room'
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

// Now all console output will be transmitted over P2P
console.log('This will be visible in the remote viewer!');
```

## 🛠️ Development

### Workspace Commands

This is an npm workspaces monorepo. You can run commands in specific workspaces:

```bash
# Run dev server for the console app
npm run dev --workspace=p2p-console-viewer-console

# Build the library
npm run build --workspace=p2p-console-viewer-lib

# Install dependencies for all workspaces
npm install

# Run tests (from root)
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

### Project-Specific Commands

Each workspace has its own scripts.  Navigate to the workspace directory and run:

**p2p-console-viewer-lib:**
```bash
npm run dev      # Start development server
npm run build    # Build the library
npm run type-gen # Generate TypeScript declarations
```

**p2p-console-viewer-console:**
```bash
npm run dev     # Start dev server
npm run build   # Production build
npm run preview # Preview production build
npm run lint    # Lint and format check
npm run format  # Format code
```

**p2p-console-viewer-server:**
```bash
npm start       # Start signaling server (default: port 3000)
```

**Root-level test commands:**
```bash
npm test            # Run all tests (250 tests)
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Generate coverage report
```

## 🏛️ Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   Your App      │                    │  Console Viewer │
│                 │                    │      (Web)      │
│  ┌───────────┐  │                    │                 │
│  │  Console  │  │   WebRTC P2P       │  ┌───────────┐  │
│  │   Patch   │──┼────────────────────┼─▶│  Display  │  │
│  └───────────┘  │    Data Channel    │  └───────────┘  │
│                 │                    │                 │
│  ┌───────────┐  │                    │  ┌───────────┐  │
│  │    P2P    │  │    WebSocket       │  │    P2P    │  │
│  │Connection │──┼───────┬────────────┼──│Connection │  │
│  └───────────┘  │       │            │  └───────────┘  │
└─────────────────┘       │            └─────────────────┘
                          │
                   ┌──────▼───────┐
                   │  Signaling   │
                   │    Server    │
                   │ (WebSocket)  │
                   └──────────────┘
```

## 🔒 Security Considerations

- This is designed for development and debugging purposes
- P2P connections are direct between peers after signaling
- Consider implementing authentication for production use
- Be cautious about what console data you transmit

## 📄 License

ISC License - See [LICENSE](LICENSE) file for details

## 🤝 Contributing

This is currently a private project. If you have access and want to contribute:

1. Create a feature branch
2. Make your changes
3. Ensure all lint checks pass (`npm run lint`)
4. Submit a pull request

## 🐛 Issues

Report issues on the [GitHub Issues page](https://github.com/FooVoo/p2p-console-viewer/issues)

## 📚 Additional Resources

- **WebRTC Documentation**: [webrtc.org](https://webrtc.org/)
- **SvelteKit Docs**: [kit.svelte.dev](https://kit.svelte.dev/)
- **P2P Flow Chart**: [View Architecture Diagram](workplaces/doc/p2p-flow-chart.md)

## 🎯 Use Cases

- **Remote Debugging**: Debug applications running on remote devices or servers
- **IoT Monitoring**: Monitor console output from IoT devices in real-time
- **Distributed Systems**: View logs from multiple microservices simultaneously
- **Development Tools**: Build custom debugging tools for your applications
- **Education**: Learn about WebRTC, P2P connections, and real-time communication

## 🔮 Roadmap

- [ ] Add authentication and authorization
- [ ] Implement log filtering and search
- [ ] Add support for structured logging
- [ ] Create browser extension for easier integration
- [ ] Add recording and playback capabilities
- [ ] Implement multi-peer viewing (one viewer, multiple sources)

---

**Made with ❤️ using WebRTC, Svelte, and JavaScript**
