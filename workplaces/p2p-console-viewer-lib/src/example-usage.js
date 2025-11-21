/**
 * Example usage of WebSocket Connector and WebRTC P2P Connection
 * This demonstrates how to use both together for signaling and P2P communication
 */

import { WebSocketConnector } from './main.js';
import { P2PConnection } from './p2p-connection.js';

// ============================================
// Example 1: WebSocket Connector Usage
// ============================================

console.log('=== WebSocket Connector Example ===');

const wsConnector = new WebSocketConnector('ws://localhost:8080');

wsConnector.onMessage((message) => {
  console.log('WS Received:', message);
});

wsConnector.onOpen(() => {
  console.log('WS Connected!');
  wsConnector.send({ type: 'hello', data: 'Hello Server!' });
});

// Uncomment to connect
// wsConnector.connect();

// ============================================
// Example 2: WebRTC P2P Connection
// ============================================

console.log('\n=== WebRTC P2P Connection Example ===');

// Peer A (Initiator)
async function setupPeerA() {
  const peerA = new P2PConnection();

  // Handle incoming messages from Peer B
  peerA.onMessage((message) => {
    console.log('Peer A received:', message);
  });

  // Handle ICE candidates
  peerA.onIceCandidate((candidate) => {
    console.log('Peer A ICE candidate:', candidate);
    // In a real app, send this to Peer B via signaling server
  });

  // Handle connection established
  peerA.onConnected(() => {
    console.log('Peer A connected!');
    peerA.send({ type: 'greeting', message: 'Hello from Peer A!' });
  });

  // Create offer
  const offer = await peerA.initiate();
  console.log('Peer A created offer');

  return peerA;
}

// Peer B (Receiver)
async function setupPeerB(offer) {
  const peerB = new P2PConnection();

  // Handle incoming messages from Peer A
  peerB.onMessage((message) => {
    console.log('Peer B received:', message);
  });

  // Handle ICE candidates
  peerB.onIceCandidate((candidate) => {
    console.log('Peer B ICE candidate:', candidate);
    // In a real app, send this to Peer A via signaling server
  });

  // Handle connection established
  peerB.onConnected(() => {
    console.log('Peer B connected!');
    peerB.send({ type: 'greeting', message: 'Hello from Peer B!' });
  });

  // Receive offer and create answer
  const answer = await peerB.receiveOffer(offer);
  console.log('Peer B created answer');

  return { peerB, answer };
}

// ============================================
// Example 3: Combined WebSocket + WebRTC
// ============================================

console.log('\n=== Combined WebSocket + WebRTC Example ===');

class P2PSignalingClient {
  constructor(signalingServerUrl) {
    this.ws = new WebSocketConnector(signalingServerUrl);
    this.p2p = new P2PConnection();
    this.remotePeerId = null;

    this.setupSignaling();
    this.setupP2P();
  }

  setupSignaling() {
    // Handle signaling messages from server
    this.ws.onMessage((message) => {
      try {
        const data = JSON.parse(message);
        this.handleSignalingMessage(data);
      } catch (e) {
        console.error('Failed to parse signaling message:', e);
      }
    });

    this.ws.onOpen(() => {
      console.log('Signaling server connected');
    });
  }

  setupP2P() {
    // Send ICE candidates through signaling server
    this.p2p.onIceCandidate((candidate) => {
      this.ws.send({
        type: 'ice-candidate',
        to: this.remotePeerId,
        candidate: candidate
      });
    });

    // Send offer through signaling server
    this.p2p.onOffer((offer) => {
      this.ws.send({
        type: 'offer',
        to: this.remotePeerId,
        offer: offer
      });
    });

    // Send answer through signaling server
    this.p2p.onAnswer((answer) => {
      this.ws.send({
        type: 'answer',
        to: this.remotePeerId,
        answer: answer
      });
    });

    // Handle P2P messages
    this.p2p.onMessage((message) => {
      console.log('P2P message received:', message);
      // Handle application-level messages
    });

    // Handle P2P connection established
    this.p2p.onConnected(() => {
      console.log('P2P connection established!');
      // Now we can communicate directly without the signaling server
    });
  }

  handleSignalingMessage(data) {
    switch (data.type) {
      case 'offer':
        this.remotePeerId = data.from;
        this.p2p.receiveOffer(data.offer);
        break;

      case 'answer':
        this.p2p.receiveAnswer(data.answer);
        break;

      case 'ice-candidate':
        this.p2p.addIceCandidate(data.candidate);
        break;

      default:
        console.log('Unknown signaling message:', data);
    }
  }

  connect(signalingServer) {
    this.ws.connect();
  }

  initiateP2P(remotePeerId) {
    this.remotePeerId = remotePeerId;
    return this.p2p.initiate();
  }

  sendMessage(message) {
    return this.p2p.send(message);
  }

  disconnect() {
    this.p2p.close();
    this.ws.disconnect();
  }
}

// Usage example
const client = new P2PSignalingClient('ws://localhost:8080');

// Uncomment to use
// client.connect();
// Wait for connection, then initiate P2P with another peer
// client.initiateP2P('peer-123');
// Once connected, send messages
// client.sendMessage({ type: 'chat', text: 'Hello!' });

export { setupPeerA, setupPeerB, P2PSignalingClient };

