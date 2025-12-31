const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const os = require("os");
const uuid = require("uuid");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let nextClientId = 1;
const clients = new Map(); // id -> { ws, room, id }
const rooms = new Map(); // room -> Set<clientId>

app.use(express.json());

app.get("/status", (req, res) => {
  console.log("Status request from:", req.socket.remoteAddress);
  const roomsInfo = {};
  for (const [roomName, clientIds] of rooms.entries()) {
    roomsInfo[roomName] = Array.from(clientIds);
  }
  res.json({
    totalClients: clients.size,
    clients: Array.from(clients.keys()),
    rooms: roomsInfo,
  });
});

wss.on("connection", (ws, req) => {
  const id = uuid.v4();
  clients.set(id, { ws, room: null, id });
  console.log(`Client connected: ${id} (${req.socket.remoteAddress})`);

  // Send assigned id to client
  ws.send(JSON.stringify({ type: "id", id }));

  ws.on("message", (raw) => {
    let msg = raw.toString();
    console.log(`Received from ${id}: ${msg}`);

    // Try parse JSON, but allow raw string forward as fallback
    let parsed;
    try {
      parsed = JSON.parse(msg);
    } catch (e) {
      // simple broadcast of raw message within the room
      const clientInfo = clients.get(id);
      if (clientInfo && clientInfo.room) {
        broadcastToRoom(raw, clientInfo.room, id);
      }
      return;
    }

    // Handle room join/leave
    if (parsed.type === "join-room") {
      handleJoinRoom(id, parsed.room);
      return;
    }

    if (parsed.type === "leave-room") {
      handleLeaveRoom(id);
      return;
    }

    // Expected signaling message shape: { type, to?, data? }
    const target = parsed.to;
    const clientInfo = clients.get(id);

    if (target) {
      const targetInfo = clients.get(String(target));
      // Check if target is in same room
      if (
        targetInfo &&
        targetInfo.ws.readyState === WebSocket.OPEN &&
        clientInfo.room &&
        targetInfo.room === clientInfo.room
      ) {
        // include from so recipients know the sender id
        const forward = Object.assign({}, parsed, { from: id });
        targetInfo.ws.send(JSON.stringify(forward));
      } else {
        // Optionally notify sender that target is unavailable or not in same room
        ws.send(
          JSON.stringify({
            type: "error",
            message: "target-unavailable-or-different-room",
            to: target,
          }),
        );
      }
    } else {
      // broadcast to others in the same room
      if (clientInfo && clientInfo.room) {
        const forward = Object.assign({}, parsed, { from: id });
        broadcastToRoom(JSON.stringify(forward), clientInfo.room, id);
      }
    }
  });

  ws.on("close", (code, reason) => {
    const clientInfo = clients.get(id);
    if (clientInfo && clientInfo.room) {
      handleLeaveRoom(id);
    }
    clients.delete(id);
    console.log(`Client disconnected: ${id} (${code})`);
  });

  ws.on("error", (err) => {
    console.error(`WS error for ${id}:`, err && err.message);
  });
});

function handleJoinRoom(clientId, roomName) {
  const clientInfo = clients.get(clientId);
  if (!clientInfo) return;

  // Leave current room if in one
  if (clientInfo.room) {
    handleLeaveRoom(clientId);
  }

  // Join new room
  clientInfo.room = roomName;
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName).add(clientId);

  console.log(`Client ${clientId} joined room: ${roomName}`);

  // Send confirmation to client
  clientInfo.ws.send(
    JSON.stringify({
      type: "room-joined",
      room: roomName,
    }),
  );

  // Notify others in room about new peer
  broadcastToRoom(
    JSON.stringify({
      type: "peer-joined",
      peerId: clientId,
    }),
    roomName,
    clientId,
  );

  // Send list of existing peers in room to the new client
  const roomClients = Array.from(rooms.get(roomName)).filter(
    (id) => id !== clientId,
  );
  clientInfo.ws.send(
    JSON.stringify({
      type: "room-peers",
      peers: roomClients,
    }),
  );
}

function handleLeaveRoom(clientId) {
  const clientInfo = clients.get(clientId);
  if (!clientInfo || !clientInfo.room) return;

  const roomName = clientInfo.room;
  const room = rooms.get(roomName);

  if (room) {
    room.delete(clientId);

    // Notify others in room that peer left
    broadcastToRoom(
      JSON.stringify({
        type: "peer-left",
        peerId: clientId,
      }),
      roomName,
      clientId,
    );

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomName);
      console.log(`Room ${roomName} is now empty and removed`);
    }
  }

  clientInfo.room = null;
  console.log(`Client ${clientId} left room: ${roomName}`);

  // Send confirmation to client if still connected
  if (clientInfo.ws.readyState === WebSocket.OPEN) {
    clientInfo.ws.send(
      JSON.stringify({
        type: "room-left",
        room: roomName,
      }),
    );
  }
}

function broadcastToRoom(message, roomName, exceptId) {
  const room = rooms.get(roomName);
  if (!room) return;

  for (const clientId of room) {
    if (clientId === exceptId) continue;
    const clientInfo = clients.get(clientId);
    if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
      clientInfo.ws.send(
        typeof message === "string" ? message : JSON.stringify(message),
      );
    }
  }
}

function broadcastExcept(message, exceptId) {
  for (const [cid, clientInfo] of clients.entries()) {
    if (cid === exceptId) continue;
    if (clientInfo.ws.readyState === WebSocket.OPEN) {
      clientInfo.ws.send(
        typeof message === "string" ? message : JSON.stringify(message),
      );
    }
  }
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-ipv4
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

server.listen(PORT, HOST, () => {
  const lanIp = getLanIp();
  console.log(`HTTP+WS signaling server listening on ${HOST}:${PORT}`);
  console.log(
    `Accessible on LAN at: http://${lanIp}:${PORT}   ws://${lanIp}:${PORT}`,
  );
  console.log(`GET /status to see connected clients and rooms`);
});
