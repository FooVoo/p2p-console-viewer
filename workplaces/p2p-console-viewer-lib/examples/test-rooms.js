/**
 * Test script for room-based signaling
 * 
 * This test verifies:
 * 1. Clients can join rooms
 * 2. Clients in the same room can discover each other
 * 3. Clients in different rooms are isolated
 * 4. Room cleanup works properly
 */

import { P2PSignalingClient } from "../src/p2p-signaling-client.js";

const SIGNALING_SERVER = "ws://localhost:3000";

// Helper to wait for a condition
function waitFor(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for condition"));
      }
    }, 100);
  });
}

// Test 1: Join room and verify
async function testJoinRoom() {
  console.log("\n=== Test 1: Join Room ===");
  
  const client = new P2PSignalingClient(SIGNALING_SERVER, {
    room: "test-room-1"
  });
  
  client.connect();
  
  // Wait for connection and room join
  await waitFor(() => client.currentRoom === "test-room-1");
  
  console.log("✓ Client connected and joined room");
  console.log("  Client ID:", client.currentServerID);
  console.log("  Room:", client.currentRoom);
  
  client.disconnect();
  
  // Wait a bit for cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return true;
}

// Test 2: Two clients in same room
async function testSameRoom() {
  console.log("\n=== Test 2: Two Clients in Same Room ===");
  
  const client1 = new P2PSignalingClient(SIGNALING_SERVER, {
    room: "same-room"
  });
  
  const client2 = new P2PSignalingClient(SIGNALING_SERVER, {
    room: "same-room"
  });
  
  client1.connect();
  
  // Wait for client1 to connect
  await waitFor(() => client1.currentRoom === "same-room");
  console.log("✓ Client 1 joined room");
  console.log("  Client 1 ID:", client1.currentServerID);
  
  // Connect client2
  client2.connect();
  
  // Wait for client2 to connect and see client1
  await waitFor(() => client2.roomPeers.length > 0);
  console.log("✓ Client 2 joined room and discovered Client 1");
  console.log("  Client 2 ID:", client2.currentServerID);
  console.log("  Client 2 sees peers:", client2.roomPeers);
  
  // Client1 should also see client2
  await waitFor(() => client1.roomPeers.length > 0);
  console.log("✓ Client 1 discovered Client 2");
  console.log("  Client 1 sees peers:", client1.roomPeers);
  
  client1.disconnect();
  client2.disconnect();
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return true;
}

// Test 3: Clients in different rooms
async function testDifferentRooms() {
  console.log("\n=== Test 3: Clients in Different Rooms ===");
  
  const clientA = new P2PSignalingClient(SIGNALING_SERVER, {
    room: "room-A"
  });
  
  const clientB = new P2PSignalingClient(SIGNALING_SERVER, {
    room: "room-B"
  });
  
  clientA.connect();
  clientB.connect();
  
  // Wait for both to connect
  await waitFor(() => clientA.currentRoom === "room-A" && clientB.currentRoom === "room-B");
  
  console.log("✓ Client A joined room-A");
  console.log("  Client A ID:", clientA.currentServerID);
  console.log("✓ Client B joined room-B");
  console.log("  Client B ID:", clientB.currentServerID);
  
  // Wait a bit and verify they don't see each other
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (clientA.roomPeers.length === 0 && clientB.roomPeers.length === 0) {
    console.log("✓ Clients in different rooms are isolated");
    console.log("  Client A peers:", clientA.roomPeers);
    console.log("  Client B peers:", clientB.roomPeers);
  } else {
    throw new Error("Clients in different rooms should not see each other");
  }
  
  clientA.disconnect();
  clientB.disconnect();
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return true;
}

// Test 4: Switch rooms
async function testSwitchRooms() {
  console.log("\n=== Test 4: Switch Rooms ===");
  
  const client = new P2PSignalingClient(SIGNALING_SERVER);
  
  client.connect();
  
  // Wait for connection
  await waitFor(() => client.currentServerID !== null);
  console.log("✓ Client connected");
  console.log("  Client ID:", client.currentServerID);
  
  // Join first room
  client.joinRoom("room-1");
  await waitFor(() => client.currentRoom === "room-1");
  console.log("✓ Joined room-1");
  
  // Switch to second room
  client.leaveRoom();
  await waitFor(() => client.currentRoom === null);
  console.log("✓ Left room-1");
  
  client.joinRoom("room-2");
  await waitFor(() => client.currentRoom === "room-2");
  console.log("✓ Joined room-2");
  
  client.disconnect();
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return true;
}

// Run all tests
async function runTests() {
  console.log("Starting Room-Based Signaling Tests...");
  console.log("========================================");
  
  try {
    await testJoinRoom();
    await testSameRoom();
    await testDifferentRooms();
    await testSwitchRooms();
    
    console.log("\n========================================");
    console.log("✓ All tests passed!");
    console.log("========================================\n");
    
    process.exit(0);
  } catch (error) {
    console.error("\n========================================");
    console.error("✗ Test failed:", error.message);
    console.error("========================================\n");
    process.exit(1);
  }
}

// Run tests
runTests();
