const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const os = require("os");
const uuid = require("uuid");
// const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let nextClientId = 1;
const clients = new Map(); // id -> ws

// app.use(cors({origin: '*'}));
app.use(express.json());

app.get("/status", (req, res) => {
  console.log("Status Code: " + req.url);
  res.json({
    clients: Array.from(clients.keys()),
  });
});

wss.on("connection", (ws, req) => {
  const id = uuid.v4();
  clients.set(id, ws);
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
      // simple broadcast of raw message
      broadcastExcept(raw, id);
      return;
    }

    // Expected signaling message shape: { type, to?, data? }
    const target = parsed.to;
    if (target) {
      const targetWs = clients.get(String(target));
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        // include from so recipients know the sender id
        const forward = Object.assign({}, parsed, { from: id });
        targetWs.send(JSON.stringify(forward));
      } else {
        // Optionally notify sender that target is unavailable
        ws.send(
          JSON.stringify({
            type: "error",
            message: "target-unavailable",
            to: target,
          }),
        );
      }
    } else {
      // broadcast to others
      const forward = Object.assign({}, parsed, { from: id });
      broadcastExcept(JSON.stringify(forward), id);
    }
  });

  ws.on("close", (code, reason) => {
    clients.delete(id);
    console.log(`Client disconnected: ${id} (${code})`);
    // Notify remaining clients that this peer left
    broadcastExcept(JSON.stringify({ type: "peer-left", id }), id);
  });

  ws.on("error", (err) => {
    console.error(`WS error for ${id}:`, err && err.message);
  });
});

function broadcastExcept(message, exceptId) {
  for (const [cid, clientWs] of clients.entries()) {
    if (cid === exceptId) continue;
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
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
  console.log(`GET /status to see connected clients`);
});
