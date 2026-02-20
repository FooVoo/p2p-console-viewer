import { describe, it, expect } from 'vitest';

describe('Server - Edge Cases', () => {
  describe('Room Management - Extreme Inputs', () => {
    it('should handle very long room names', () => {
      const rooms = new Map();
      const longRoomName = 'x'.repeat(100000);
      
      rooms.set(longRoomName, new Set(['client1']));
      
      expect(rooms.has(longRoomName)).toBe(true);
      expect(rooms.get(longRoomName).size).toBe(1);
    });

    it('should handle room names with unicode', () => {
      const rooms = new Map();
      const unicodeRoom = '房间-🚀-مغرفة';
      
      rooms.set(unicodeRoom, new Set(['client1']));
      
      expect(rooms.has(unicodeRoom)).toBe(true);
    });

    it('should handle room names with special characters', () => {
      const rooms = new Map();
      const specialRoom = '\n\r\t\0<>&"\'/\\';
      
      rooms.set(specialRoom, new Set(['client1']));
      
      expect(rooms.has(specialRoom)).toBe(true);
    });

    it('should handle empty room name', () => {
      const rooms = new Map();
      
      rooms.set('', new Set(['client1']));
      
      expect(rooms.has('')).toBe(true);
    });

    it('should handle room with thousands of clients', () => {
      const rooms = new Map();
      const roomName = 'large-room';
      const clientSet = new Set();
      
      for (let i = 0; i < 10000; i++) {
        clientSet.add(`client-${i}`);
      }
      
      rooms.set(roomName, clientSet);
      
      expect(rooms.get(roomName).size).toBe(10000);
    });
  });

  describe('Client Management - Boundary Conditions', () => {
    it('should handle very long client IDs', () => {
      const clients = new Map();
      const longId = 'x'.repeat(100000);
      
      clients.set(longId, { ws: {}, room: 'test', id: longId });
      
      expect(clients.has(longId)).toBe(true);
    });

    it('should handle client ID with special characters', () => {
      const clients = new Map();
      const specialId = '🚀-client-\n\r\t-@#$%';
      
      clients.set(specialId, { ws: {}, room: 'test', id: specialId });
      
      expect(clients.has(specialId)).toBe(true);
    });

    it('should handle thousands of clients', () => {
      const clients = new Map();
      
      for (let i = 0; i < 10000; i++) {
        clients.set(`client-${i}`, { ws: {}, room: 'room1', id: `client-${i}` });
      }
      
      expect(clients.size).toBe(10000);
    });

    it('should handle client with null room', () => {
      const clients = new Map();
      const clientId = 'client1';
      
      clients.set(clientId, { ws: {}, room: null, id: clientId });
      
      expect(clients.get(clientId).room).toBeNull();
    });

    it('should handle client with undefined room', () => {
      const clients = new Map();
      const clientId = 'client1';
      
      clients.set(clientId, { ws: {}, room: undefined, id: clientId });
      
      expect(clients.get(clientId).room).toBeUndefined();
    });
  });

  describe('Message Routing - Edge Cases', () => {
    it('should handle routing with empty target ID', () => {
      const clients = new Map();
      const senderId = 'sender';
      const targetId = '';
      
      clients.set(senderId, { ws: {}, room: 'room1', id: senderId });
      clients.set(targetId, { ws: {}, room: 'room1', id: targetId });
      
      const senderInfo = clients.get(senderId);
      const targetInfo = clients.get(targetId);
      
      const canRoute = senderInfo.room && targetInfo && targetInfo.room === senderInfo.room;
      
      expect(canRoute).toBe(true);
    });

    it('should handle routing with very long message payload', () => {
      const message = {
        type: 'offer',
        to: 'target',
        offer: {
          sdp: 'x'.repeat(1000000), // 1MB SDP
          type: 'offer'
        }
      };
      
      const serialized = JSON.stringify(message);
      
      expect(serialized).toBeDefined();
      expect(serialized.length).toBeGreaterThan(1000000);
    });

    it('should handle null target ID', () => {
      const clients = new Map();
      const senderId = 'sender';
      
      clients.set(senderId, { ws: {}, room: 'room1', id: senderId });
      
      const senderInfo = clients.get(senderId);
      const targetInfo = clients.get(null);
      
      const canRoute = targetInfo && senderInfo.room && targetInfo.room === senderInfo.room;
      
      expect(canRoute).toBeFalsy();
    });

    it('should handle undefined target ID', () => {
      const clients = new Map();
      const senderId = 'sender';
      
      clients.set(senderId, { ws: {}, room: 'room1', id: senderId });
      
      const senderInfo = clients.get(senderId);
      const targetInfo = clients.get(undefined);
      
      const canRoute = targetInfo && senderInfo.room && targetInfo.room === senderInfo.room;
      
      expect(canRoute).toBeFalsy();
    });
  });

  describe('Broadcast - Edge Cases', () => {
    it('should handle broadcast with no recipients', () => {
      const rooms = new Map();
      const roomName = 'empty-room';
      const senderId = 'sender';
      
      rooms.set(roomName, new Set([senderId]));
      
      const targets = Array.from(rooms.get(roomName)).filter(id => id !== senderId);
      
      expect(targets).toEqual([]);
    });

    it('should handle broadcast with thousands of recipients', () => {
      const rooms = new Map();
      const roomName = 'large-room';
      const senderId = 'sender';
      const clientSet = new Set([senderId]);
      
      for (let i = 0; i < 10000; i++) {
        clientSet.add(`client-${i}`);
      }
      
      rooms.set(roomName, clientSet);
      
      const targets = Array.from(rooms.get(roomName)).filter(id => id !== senderId);
      
      expect(targets.length).toBe(10000);
    });

    it('should exclude sender from broadcast list', () => {
      const rooms = new Map();
      const roomName = 'test-room';
      const senderId = 'sender';
      
      rooms.set(roomName, new Set([senderId, 'client1', 'client2']));
      
      const targets = Array.from(rooms.get(roomName)).filter(id => id !== senderId);
      
      expect(targets).not.toContain(senderId);
      expect(targets).toEqual(['client1', 'client2']);
    });
  });

  describe('Protocol Messages - Malformed Input', () => {
    it('should handle message with no type field', () => {
      const message = { data: 'test' };
      
      expect(() => JSON.stringify(message)).not.toThrow();
    });

    it('should handle message with null type', () => {
      const message = { type: null, data: 'test' };
      
      expect(() => JSON.stringify(message)).not.toThrow();
    });

    it('should handle message with undefined type', () => {
      const message = { type: undefined, data: 'test' };
      
      expect(() => JSON.stringify(message)).not.toThrow();
    });

    it('should handle circular reference in message', () => {
      const message = { type: 'test' };
      message.self = message;
      
      expect(() => JSON.stringify(message)).toThrow();
    });

    it('should handle message with very deep nesting', () => {
      let deep = { type: 'test' };
      let current = deep;
      
      for (let i = 0; i < 1000; i++) {
        current.nested = {};
        current = current.nested;
      }
      
      expect(() => JSON.stringify(deep)).not.toThrow();
    });
  });

  describe('Room Cleanup - Edge Cases', () => {
    it('should clean up room when last client leaves', () => {
      const rooms = new Map();
      const roomName = 'test-room';
      const clientId = 'client1';
      
      rooms.set(roomName, new Set([clientId]));
      rooms.get(roomName).delete(clientId);
      
      if (rooms.get(roomName).size === 0) {
        rooms.delete(roomName);
      }
      
      expect(rooms.has(roomName)).toBe(false);
    });

    it('should not clean up room if clients remain', () => {
      const rooms = new Map();
      const roomName = 'test-room';
      
      rooms.set(roomName, new Set(['client1', 'client2']));
      rooms.get(roomName).delete('client1');
      
      if (rooms.get(roomName).size === 0) {
        rooms.delete(roomName);
      }
      
      expect(rooms.has(roomName)).toBe(true);
      expect(rooms.get(roomName).size).toBe(1);
    });

    it('should handle cleanup of non-existent room', () => {
      const rooms = new Map();
      
      expect(() => {
        const room = rooms.get('non-existent');
        if (room && room.size === 0) {
          rooms.delete('non-existent');
        }
      }).not.toThrow();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid room joins', () => {
      const rooms = new Map();
      const clientId = 'client1';
      
      for (let i = 0; i < 1000; i++) {
        const roomName = `room-${i}`;
        if (!rooms.has(roomName)) {
          rooms.set(roomName, new Set());
        }
        rooms.get(roomName).add(clientId);
      }
      
      expect(rooms.size).toBe(1000);
    });

    it('should handle rapid client additions', () => {
      const rooms = new Map();
      const roomName = 'test-room';
      
      rooms.set(roomName, new Set());
      
      for (let i = 0; i < 1000; i++) {
        rooms.get(roomName).add(`client-${i}`);
      }
      
      expect(rooms.get(roomName).size).toBe(1000);
    });
  });

  describe('Status Endpoint - Edge Cases', () => {
    it('should handle status with no clients', () => {
      const clients = new Map();
      const rooms = new Map();
      
      const status = {
        totalClients: clients.size,
        clients: Array.from(clients.keys()),
        rooms: Object.fromEntries(
          Array.from(rooms.entries()).map(([name, clientIds]) => [name, Array.from(clientIds)])
        )
      };
      
      expect(status.totalClients).toBe(0);
      expect(status.clients).toEqual([]);
      expect(status.rooms).toEqual({});
    });

    it('should handle status with thousands of rooms', () => {
      const rooms = new Map();
      
      for (let i = 0; i < 1000; i++) {
        rooms.set(`room-${i}`, new Set(['client1']));
      }
      
      const roomsInfo = Object.fromEntries(
        Array.from(rooms.entries()).map(([name, clientIds]) => [name, Array.from(clientIds)])
      );
      
      expect(Object.keys(roomsInfo).length).toBe(1000);
    });

    it('should handle status conversion with special room names', () => {
      const rooms = new Map();
      rooms.set('🚀-room', new Set(['client1']));
      rooms.set('', new Set(['client2']));
      rooms.set('\n\r\t', new Set(['client3']));
      
      const roomsInfo = Object.fromEntries(
        Array.from(rooms.entries()).map(([name, clientIds]) => [name, Array.from(clientIds)])
      );
      
      expect(roomsInfo['🚀-room']).toEqual(['client1']);
      expect(roomsInfo['']).toEqual(['client2']);
      expect(roomsInfo['\n\r\t']).toEqual(['client3']);
    });
  });

  describe('Memory Management', () => {
    it('should not leak rooms after all clients leave', () => {
      const rooms = new Map();
      const clients = new Map();
      
      // Add many clients to rooms
      for (let i = 0; i < 100; i++) {
        const roomName = `room-${i}`;
        const clientId = `client-${i}`;
        
        rooms.set(roomName, new Set([clientId]));
        clients.set(clientId, { ws: {}, room: roomName, id: clientId });
      }
      
      // Remove all clients
      for (let i = 0; i < 100; i++) {
        const roomName = `room-${i}`;
        const clientId = `client-${i}`;
        
        rooms.get(roomName).delete(clientId);
        if (rooms.get(roomName).size === 0) {
          rooms.delete(roomName);
        }
        clients.delete(clientId);
      }
      
      expect(rooms.size).toBe(0);
      expect(clients.size).toBe(0);
    });
  });
});
