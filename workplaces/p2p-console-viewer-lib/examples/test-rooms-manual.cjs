/**
 * Simple manual test for room-based signaling
 * Uses native Node.js WebSocket from 'ws' package
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:3000';

// Helper to create a client
function createClient(name, room) {
  const ws = new WebSocket(SERVER_URL);
  let clientId = null;
  
  ws.on('open', () => {
    console.log(`[${name}] Connected to server`);
    if (room) {
      ws.send(JSON.stringify({ type: 'join-room', room }));
    }
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log(`[${name}] Received:`, msg);
    
    if (msg.type === 'id') {
      clientId = msg.id;
      console.log(`[${name}] Assigned ID: ${clientId}`);
    } else if (msg.type === 'room-joined') {
      console.log(`[${name}] Successfully joined room: ${msg.room}`);
    } else if (msg.type === 'room-peers') {
      console.log(`[${name}] Peers in room:`, msg.peers);
    } else if (msg.type === 'peer-joined') {
      console.log(`[${name}] New peer joined: ${msg.peerId}`);
    } else if (msg.type === 'peer-left') {
      console.log(`[${name}] Peer left: ${msg.peerId}`);
    }
  });
  
  ws.on('close', () => {
    console.log(`[${name}] Disconnected from server`);
  });
  
  ws.on('error', (error) => {
    console.error(`[${name}] Error:`, error.message);
  });
  
  return { ws, getName: () => name, getId: () => clientId };
}

// Test 1: Two clients in same room
console.log('\n=== Test 1: Two clients in same room ===\n');

const client1 = createClient('Client-A', 'test-room');
setTimeout(() => {
  const client2 = createClient('Client-B', 'test-room');
  
  // After some time, disconnect
  setTimeout(() => {
    console.log('\n--- Disconnecting clients ---\n');
    client1.ws.close();
    client2.ws.close();
    
    // Test 2: Clients in different rooms
    setTimeout(() => {
      console.log('\n=== Test 2: Clients in different rooms ===\n');
      const client3 = createClient('Client-C', 'room-1');
      const client4 = createClient('Client-D', 'room-2');
      
      // Disconnect after some time
      setTimeout(() => {
        console.log('\n--- Test completed ---\n');
        client3.ws.close();
        client4.ws.close();
        
        // Exit after cleanup
        setTimeout(() => process.exit(0), 1000);
      }, 3000);
    }, 1000);
  }, 3000);
}, 1000);
