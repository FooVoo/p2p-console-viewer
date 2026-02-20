/**
 * Example demonstrating room-based P2P signaling
 * 
 * This example shows how to:
 * 1. Connect to a signaling server
 * 2. Join a specific room
 * 3. Discover and connect to peers in the same room
 * 4. Communicate over P2P connections
 */

import { P2PSignalingClient } from "../src/p2p-signaling-client.js";

// Example 1: Join a room on initialization
console.log("=== Example 1: Join room on initialization ===");

const client1 = new P2PSignalingClient("ws://localhost:3000", {
  room: "my-room",
});

client1.whenConnected(() => {
  console.log("Client 1 connected to signaling server");
  console.log("Client 1 ID:", client1.currentServerID);
  console.log("Client 1 Room:", client1.currentRoom);
});

// Example 2: Join a room after connection
console.log("\n=== Example 2: Join room after connection ===");

const client2 = new P2PSignalingClient("ws://localhost:3000");

client2.whenConnected(() => {
  console.log("Client 2 connected to signaling server");
  console.log("Client 2 ID:", client2.currentServerID);
  
  // Join a room after connection
  setTimeout(() => {
    client2.joinRoom("my-room");
  }, 1000);
});

// Example 3: Switch between rooms
console.log("\n=== Example 3: Switch between rooms ===");

const client3 = new P2PSignalingClient("ws://localhost:3000");

client3.whenConnected(() => {
  console.log("Client 3 connected to signaling server");
  
  // Join first room
  setTimeout(() => {
    client3.joinRoom("room-1");
    console.log("Client 3 joined room-1");
  }, 1000);
  
  // Switch to another room
  setTimeout(() => {
    client3.leaveRoom();
    setTimeout(() => {
      client3.joinRoom("room-2");
      console.log("Client 3 switched to room-2");
    }, 500);
  }, 3000);
});

// Example 4: Full P2P connection flow within a room
console.log("\n=== Example 4: Full P2P connection flow ===");

async function setupRoomBasedP2P() {
  const roomName = "test-room";
  
  // Peer A - joins room and waits for peers
  const peerA = new P2PSignalingClient("ws://localhost:3000", {
    room: roomName,
  });
  
  peerA.whenConnected(() => {
    console.log("Peer A connected and joined room:", roomName);
    console.log("Peer A ID:", peerA.currentServerID);
    
    // Listen for when other peers join
    const checkForPeers = setInterval(() => {
      const peers = peerA.getRoomPeers();
      if (peers.length > 0) {
        console.log("Peer A sees peers in room:", peers);
        // Initiate P2P connection with first peer
        const remotePeerId = peers[0];
        console.log("Peer A initiating P2P with:", remotePeerId);
        peerA.initiateP2P(remotePeerId);
        clearInterval(checkForPeers);
      }
    }, 1000);
  });
  
  // Peer B - joins same room after a delay
  setTimeout(() => {
    const peerB = new P2PSignalingClient("ws://localhost:3000", {
      room: roomName,
    });
    
    peerB.whenConnected(() => {
      console.log("Peer B connected and joined room:", roomName);
      console.log("Peer B ID:", peerB.currentServerID);
      const peers = peerB.getRoomPeers();
      console.log("Peer B sees peers in room:", peers);
    });
  }, 2000);
}

// Example usage (uncomment to run):
// setupRoomBasedP2P();

export { client1, client2, client3, setupRoomBasedP2P };
