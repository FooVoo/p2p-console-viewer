const path = require("path");
require("dotenv").config({path: path.join(__dirname, ".env")});

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const os = require("os");
const {v4: uuidv4} = require("uuid");

const app = express();
const server = http.createServer(app);

// Guardrail config (env overrides)
const MAX_PAYLOAD = parseInt(process.env.MAX_PAYLOAD || String(64 * 1024), 10); // bytes
const MAX_CLIENTS = parseInt(process.env.MAX_CLIENTS || "1000", 10);
const MAX_ROOM_CLIENTS = parseInt(process.env.MAX_ROOM_CLIENTS || "50", 10);
const MESSAGE_RATE_PER_SEC = parseFloat(process.env.MESSAGE_RATE_PER_SEC || "10"); // tokens/sec
const MESSAGE_BURST = parseFloat(process.env.MESSAGE_BURST || "20"); // burst tokens
const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || "30000", 10); // ms
const WS_SECRET = process.env.WS_SECRET || ""; // set to enable simple auth
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean); // optional


const wss = new WebSocket.Server({server, maxPayload: MAX_PAYLOAD});

const clients = new Map(); // id -> { ws, room, id, rate }
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

function safeSend(ws, payload) {
  try {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  } catch (err) {
    // defend against uncaught send errors
    try {
      ws.terminate();
    } catch (e) {
    }
    console.error("Failed to send to client:", err && err.message);
  }
}

function isValidRoomName(name) {
  return typeof name === "string" && /^[A-Za-z0-9\-_]{1,64}$/.test(name);
}

function rateAllow(rate) {
  const now = Date.now();
  const elapsed = Math.max(0, (now - rate.last) / 1000);
  rate.tokens = Math.min(MESSAGE_BURST, rate.tokens + elapsed * MESSAGE_RATE_PER_SEC);
  rate.last = now;
  if (rate.tokens >= 1) {
    rate.tokens -= 1;
    return true;
  }
  return false;
}

wss.on("connection", (ws, req) => {
  // enforce max clients
  if (clients.size >= MAX_CLIENTS) {
    try {
      ws.close(1013, "server-overloaded");
    } catch (e) {
    }
    return;
  }

  // origin check if configured
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
    try {
      ws.close(1008, "origin-not-allowed");
    } catch (e) {
    }
    return;
  }

  // simple token auth via query param if WS_SECRET configured
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const token = url.searchParams.get("token") || "";
  if (WS_SECRET && token !== WS_SECRET) {
    try {
      ws.close(4003, "auth-failed");
    } catch (e) {
    }
    return;
  }

  const id = uuidv4();
  clients.set(id, {
    ws,
    room: null,
    id,
    rate: {tokens: MESSAGE_BURST, last: Date.now()},
    isAlive: true,
  });
  console.log(`Client connected: ${id} (${req.socket.remoteAddress})`);

  // Send assigned id to client
  safeSend(ws, JSON.stringify({type: "id", id}));

  // heartbeat handling
  ws.isAlive = true;
  ws.on("pong", () => {
    const ci = clients.get(id);
    if (ci) ci.isAlive = true;
    ws.isAlive = true;
  });

  ws.on("message", (raw) => {
    // basic rate limiting
    const clientInfo = clients.get(id);
    if (!clientInfo) return;
    if (!rateAllow(clientInfo.rate)) {
      safeSend(ws, JSON.stringify({type: "error", message: "rate-limit"}));
      return;
    }

    let msg = raw.toString();
    const logMsg = msg.length > 200 ? msg.slice(0, 200) + "...(truncated)" : msg;
    console.log(`Received from ${id}: ${logMsg}`);

    // Try parse JSON, but allow raw string forward as fallback
    let parsed;
    try {
      parsed = JSON.parse(msg);

      // Basic validation against prototype pollution and unexpected types
      if (parsed && typeof parsed === "object") {
        // ensure no prototype keys
        if (Object.prototype.hasOwnProperty.call(parsed, "__proto__") ||
            Object.prototype.hasOwnProperty.call(parsed, "constructor")) {
          safeSend(ws, JSON.stringify({type: "error", message: "invalid-message"}));
          return;
        }
      } else {
        // not an object
        parsed = null;
      }
    } catch (e) {
      // simple broadcast of raw message within the room
      if (clientInfo && clientInfo.room) {
        broadcastToRoom(String(raw), clientInfo.room, id);
      }
      return;
    }

    if (!parsed || typeof parsed.type !== "string") {
      safeSend(ws, JSON.stringify({type: "error", message: "invalid-message"}));
      return;
    }

    // Handle room join/leave
    if (parsed.type === "join-room") {
      const roomName = parsed.room;
      if (!isValidRoomName(roomName)) {
        safeSend(ws, JSON.stringify({type: "error", message: "invalid-room-name"}));
        return;
      }
      const roomSet = rooms.get(roomName);
      if (roomSet && roomSet.size >= MAX_ROOM_CLIENTS) {
        safeSend(ws, JSON.stringify({type: "error", message: "room-full"}));
        return;
      }
      handleJoinRoom(id, roomName);
      return;
    }

    if (parsed.type === "leave-room") {
      handleLeaveRoom(id);
      return;
    }

    // Expected signaling message shape: { type, to?, data? }
    const target = parsed.to;
    const ci = clients.get(id);

    if (target) {
      const targetInfo = clients.get(String(target));
      // Check if target is in same room
      if (
          targetInfo &&
          targetInfo.ws.readyState === WebSocket.OPEN &&
          ci.room &&
          targetInfo.room === ci.room
      ) {
        // include from so recipients know the sender id
        const forward = Object.assign({}, parsed, { from: id });
        safeSend(targetInfo.ws, JSON.stringify(forward));
      } else {
        safeSend(ws, JSON.stringify({
          type: "error",
          message: "target-unavailable-or-different-room",
          to: target,
        }));
      }
    } else {
      // broadcast to others in the same room
      if (ci && ci.room) {
        const forward = Object.assign({}, parsed, { from: id });
        broadcastToRoom(JSON.stringify(forward), ci.room, id);
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
  safeSend(clientInfo.ws, JSON.stringify({type: "room-joined", room: roomName}));

  // Notify others in room about new peer
  broadcastToRoom(JSON.stringify({type: "peer-joined", peerId: clientId}), roomName, clientId);

  // Send list of existing peers in room to the new client
  const roomClients = Array.from(rooms.get(roomName)).filter((id) => id !== clientId);
  safeSend(clientInfo.ws, JSON.stringify({type: "room-peers", peers: roomClients}));
}

function handleLeaveRoom(clientId) {
  const clientInfo = clients.get(clientId);
  if (!clientInfo || !clientInfo.room) return;

  const roomName = clientInfo.room;
  const room = rooms.get(roomName);

  if (room) {
    room.delete(clientId);

    // Notify others in room that peer left
    broadcastToRoom(JSON.stringify({type: "peer-left", peerId: clientId}), roomName, clientId);

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
    safeSend(clientInfo.ws, JSON.stringify({type: "room-left", room: roomName}));
  }
}

function broadcastToRoom(message, roomName, exceptId) {
  const room = rooms.get(roomName);
  if (!room) return;

  const payload = typeof message === "string" ? message : JSON.stringify(message);

  for (const clientId of room) {
    if (clientId === exceptId) continue;
    const clientInfo = clients.get(clientId);
    if (clientInfo && clientInfo.ws.readyState === WebSocket.OPEN) {
      safeSend(clientInfo.ws, payload);
    }
  }
}

// Heartbeat: periodically ping clients and terminate dead ones
setInterval(() => {
  for (const [id, info] of clients.entries()) {
    try {
      if (!info.isAlive || info.ws.readyState !== WebSocket.OPEN) {
        try {
          info.ws.terminate();
        } catch (e) {
        }
        clients.delete(id);
        if (info.room) {
          const room = rooms.get(info.room);
          if (room) {
            room.delete(id);
            broadcastToRoom(JSON.stringify({type: "peer-left", peerId: id}), info.room, id);
            if (room.size === 0) rooms.delete(info.room);
          }
        }
        console.log(`Terminated dead client: ${id}`);
      } else {
        info.isAlive = false;
        try {
          info.ws.ping();
        } catch (e) {
        }
      }
    } catch (err) {
      console.error("Heartbeat error:", err && err.message);
    }
  }
}, HEARTBEAT_INTERVAL);

// Server listen
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
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
  console.log(`Accessible on LAN at: http://${lanIp}:${PORT}   ws://${lanIp}:${PORT}`);
  console.log(`GET /status to see connected clients and rooms`);
});
