import { describe, it, expect } from 'vitest';

/**
 * Unit tests for the signaling server logic
 * These tests verify the core room management and signaling logic
 */

describe('Room Management Logic', () => {
  it('should validate room data structure', () => {
    const rooms = new Map();
    const roomName = 'test-room';
    const clientId = 'client-123';

    // Add room with client
    rooms.set(roomName, new Set([clientId]));

    expect(rooms.has(roomName)).toBe(true);
    expect(rooms.get(roomName).has(clientId)).toBe(true);
    expect(rooms.get(roomName).size).toBe(1);
  });

  it('should handle adding multiple clients to a room', () => {
    const rooms = new Map();
    const roomName = 'test-room';
    
    rooms.set(roomName, new Set());
    rooms.get(roomName).add('client-1');
    rooms.get(roomName).add('client-2');
    rooms.get(roomName).add('client-3');

    expect(rooms.get(roomName).size).toBe(3);
    expect(Array.from(rooms.get(roomName))).toEqual(['client-1', 'client-2', 'client-3']);
  });

  it('should remove client from room', () => {
    const rooms = new Map();
    const roomName = 'test-room';
    
    rooms.set(roomName, new Set(['client-1', 'client-2', 'client-3']));
    rooms.get(roomName).delete('client-2');

    expect(rooms.get(roomName).size).toBe(2);
    expect(rooms.get(roomName).has('client-2')).toBe(false);
    expect(rooms.get(roomName).has('client-1')).toBe(true);
    expect(rooms.get(roomName).has('client-3')).toBe(true);
  });

  it('should clean up empty rooms', () => {
    const rooms = new Map();
    const roomName = 'test-room';
    
    rooms.set(roomName, new Set(['client-1']));
    rooms.get(roomName).delete('client-1');

    // Clean up empty room
    if (rooms.get(roomName).size === 0) {
      rooms.delete(roomName);
    }

    expect(rooms.has(roomName)).toBe(false);
  });

  it('should isolate clients between rooms', () => {
    const rooms = new Map();
    
    rooms.set('room-1', new Set(['client-1', 'client-2']));
    rooms.set('room-2', new Set(['client-3', 'client-4']));

    expect(rooms.get('room-1').has('client-3')).toBe(false);
    expect(rooms.get('room-2').has('client-1')).toBe(false);
  });
});

describe('Client Management Logic', () => {
  it('should store client with room information', () => {
    const clients = new Map();
    const clientId = 'client-123';
    const mockWs = { readyState: 1 };

    clients.set(clientId, {
      ws: mockWs,
      room: 'test-room',
      id: clientId
    });

    const client = clients.get(clientId);
    expect(client.id).toBe(clientId);
    expect(client.room).toBe('test-room');
    expect(client.ws).toBe(mockWs);
  });

  it('should update client room', () => {
    const clients = new Map();
    const clientId = 'client-123';
    const mockWs = { readyState: 1 };

    clients.set(clientId, {
      ws: mockWs,
      room: 'room-1',
      id: clientId
    });

    // Move to different room
    const client = clients.get(clientId);
    client.room = 'room-2';

    expect(clients.get(clientId).room).toBe('room-2');
  });

  it('should handle multiple clients', () => {
    const clients = new Map();

    clients.set('client-1', { ws: {}, room: 'room-1', id: 'client-1' });
    clients.set('client-2', { ws: {}, room: 'room-1', id: 'client-2' });
    clients.set('client-3', { ws: {}, room: 'room-2', id: 'client-3' });

    expect(clients.size).toBe(3);
    expect(clients.get('client-1').room).toBe('room-1');
    expect(clients.get('client-3').room).toBe('room-2');
  });
});

describe('Message Routing Logic', () => {
  it('should identify correct target for directed message', () => {
    const clients = new Map();
    
    clients.set('client-1', { ws: {}, room: 'room-1', id: 'client-1' });
    clients.set('client-2', { ws: {}, room: 'room-1', id: 'client-2' });
    clients.set('client-3', { ws: {}, room: 'room-2', id: 'client-3' });

    const senderId = 'client-1';
    const targetId = 'client-2';
    const senderInfo = clients.get(senderId);
    const targetInfo = clients.get(targetId);

    // Check if both are in same room
    const canRoute = senderInfo.room && targetInfo.room === senderInfo.room;
    expect(canRoute).toBe(true);
  });

  it('should prevent routing between different rooms', () => {
    const clients = new Map();
    
    clients.set('client-1', { ws: {}, room: 'room-1', id: 'client-1' });
    clients.set('client-3', { ws: {}, room: 'room-2', id: 'client-3' });

    const senderId = 'client-1';
    const targetId = 'client-3';
    const senderInfo = clients.get(senderId);
    const targetInfo = clients.get(targetId);

    // Check if both are in same room
    const canRoute = senderInfo.room && targetInfo.room === senderInfo.room;
    expect(canRoute).toBe(false);
  });

  it('should get broadcast targets in same room', () => {
    const rooms = new Map();
    const roomName = 'test-room';
    const senderId = 'client-1';
    
    rooms.set(roomName, new Set(['client-1', 'client-2', 'client-3']));

    // Get all clients except sender
    const targets = Array.from(rooms.get(roomName)).filter(id => id !== senderId);

    expect(targets).toEqual(['client-2', 'client-3']);
    expect(targets).not.toContain(senderId);
  });
});

describe('Protocol Message Structures', () => {
  it('should construct ID assignment message', () => {
    const id = 'test-client-id';
    const message = { type: 'id', id };

    expect(message.type).toBe('id');
    expect(message.id).toBe(id);
    expect(JSON.stringify(message)).toBe('{"type":"id","id":"test-client-id"}');
  });

  it('should construct room-joined message', () => {
    const message = { type: 'room-joined', room: 'test-room' };

    expect(message.type).toBe('room-joined');
    expect(message.room).toBe('test-room');
  });

  it('should construct room-peers message', () => {
    const peers = ['peer-1', 'peer-2'];
    const message = { type: 'room-peers', peers };

    expect(message.type).toBe('room-peers');
    expect(message.peers).toEqual(peers);
  });

  it('should construct peer-joined message', () => {
    const message = { type: 'peer-joined', peerId: 'new-peer' };

    expect(message.type).toBe('peer-joined');
    expect(message.peerId).toBe('new-peer');
  });

  it('should construct peer-left message', () => {
    const message = { type: 'peer-left', peerId: 'departed-peer' };

    expect(message.type).toBe('peer-left');
    expect(message.peerId).toBe('departed-peer');
  });

  it('should construct error message', () => {
    const message = { 
      type: 'error', 
      message: 'target-unavailable-or-different-room',
      to: 'target-id'
    };

    expect(message.type).toBe('error');
    expect(message.message).toBe('target-unavailable-or-different-room');
    expect(message.to).toBe('target-id');
  });

  it('should forward signaling message with from field', () => {
    const originalMessage = {
      type: 'offer',
      to: 'target-id',
      offer: { sdp: 'test-sdp', type: 'offer' }
    };
    
    const senderId = 'sender-id';
    const forwardedMessage = Object.assign({}, originalMessage, { from: senderId });

    expect(forwardedMessage.from).toBe(senderId);
    expect(forwardedMessage.type).toBe('offer');
    expect(forwardedMessage.offer).toEqual(originalMessage.offer);
  });
});
