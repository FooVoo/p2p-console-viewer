# P2P Console Viewer - Signaling Server

WebSocket-based signaling server for WebRTC peer-to-peer connections with room support.

## Features

- **Room-based Signaling**: Clients can join specific rooms to isolate their P2P connections
- **WebRTC Signal Routing**: Routes offers, answers, and ICE candidates between peers
- **Peer Discovery**: Notifies clients about other peers in the same room
- **Auto Cleanup**: Automatically removes empty rooms when the last client leaves
- **Status Endpoint**: HTTP endpoint to monitor connected clients and rooms

## Installation

```bash
npm install
```

## Usage

### Starting the Server

```bash
npm start
```

Or with custom port and host:

```bash
PORT=8080 HOST=localhost npm start
```

### Environment Variables

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)

### Status Endpoint

Check server status and connected clients:

```bash
curl http://localhost:3000/status
```

Response:
```json
{
  "totalClients": 2,
  "clients": ["uuid-1", "uuid-2"],
  "rooms": {
    "room-1": ["uuid-1"],
    "room-2": ["uuid-2"]
  }
}
```

## Protocol

### Client → Server Messages

#### Join Room
```json
{
  "type": "join-room",
  "room": "room-name"
}
```

#### Leave Room
```json
{
  "type": "leave-room"
}
```

#### WebRTC Signaling (within a room)
```json
{
  "type": "offer|answer|ice-candidate",
  "to": "target-peer-id",
  "offer|answer|candidate": { ... }
}
```

### Server → Client Messages

#### Client ID Assignment
```json
{
  "type": "id",
  "id": "client-uuid"
}
```

#### Room Joined Confirmation
```json
{
  "type": "room-joined",
  "room": "room-name"
}
```

#### Room Left Confirmation
```json
{
  "type": "room-left",
  "room": "room-name"
}
```

#### Existing Peers in Room
```json
{
  "type": "room-peers",
  "peers": ["peer-id-1", "peer-id-2"]
}
```

#### Peer Joined Room
```json
{
  "type": "peer-joined",
  "peerId": "new-peer-id"
}
```

#### Peer Left Room
```json
{
  "type": "peer-left",
  "peerId": "departed-peer-id"
}
```

#### WebRTC Signaling Messages
```json
{
  "type": "offer|answer|ice-candidate",
  "from": "sender-peer-id",
  "offer|answer|candidate": { ... }
}
```

#### Error Messages
```json
{
  "type": "error",
  "message": "target-unavailable-or-different-room",
  "to": "target-peer-id"
}
```

## Room Behavior

- Clients must join a room before they can exchange WebRTC signals
- Signaling messages are only routed between clients in the same room
- When a client joins a room, they receive a list of existing peers
- Other peers in the room are notified when a new client joins
- When a client leaves or disconnects, other peers are notified
- Empty rooms are automatically deleted

## Example Usage

### With P2P Console Viewer Library

```javascript
import { P2PSignalingClient } from 'p2p-console-viewer-lib';

// Connect and join a room
const client = new P2PSignalingClient('ws://localhost:3000', {
  room: 'my-room'
});

client.connect();

// Or join a room after connection
const client2 = new P2PSignalingClient('ws://localhost:3000');
client2.connect();
client2.whenConnected(() => {
  client2.joinRoom('my-room');
});
```

### With Native WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // Join a room
  ws.send(JSON.stringify({
    type: 'join-room',
    room: 'my-room'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
  
  if (data.type === 'room-joined') {
    console.log('Joined room:', data.room);
  } else if (data.type === 'room-peers') {
    console.log('Peers in room:', data.peers);
  }
};
```

## Architecture

```
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Client A│         │ Server  │         │ Client B│
│ (Room 1)│         │         │         │ (Room 1)│
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │  join-room(1)     │                   │
     ├──────────────────>│                   │
     │  room-joined(1)   │                   │
     │<──────────────────┤                   │
     │                   │  join-room(1)     │
     │                   │<──────────────────┤
     │  peer-joined(B)   │  room-joined(1)   │
     │<──────────────────┤──────────────────>│
     │                   │  room-peers([A])  │
     │                   │──────────────────>│
     │                   │                   │
     │  offer(to:B)      │                   │
     ├──────────────────>│  offer(from:A)    │
     │                   ├──────────────────>│
     │                   │  answer(to:A)     │
     │  answer(from:B)   │<──────────────────┤
     │<──────────────────┤                   │
     │                   │                   │
     │    WebRTC P2P Connection Established  │
     │<─────────────────────────────────────>│
```

## License

ISC

## Related Projects

- [p2p-console-viewer-lib](../p2p-console-viewer-lib) - Client library for P2P connections
- [p2p-console-viewer-console](../p2p-console-viewer-console) - Web UI for viewing console logs
