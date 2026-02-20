# Replacing In-Memory State with Vercel KV

The signaling server's REST API (`workplaces/p2p-console-viewer-server/api/`) runs as Vercel serverless functions. Each function invocation is an isolated process, so the default in-memory `RoomManager` in `lib/shared-state.js` does **not** share state across requests.

This guide explains how to create a Vercel KV store and adapt the server to use it for persistent, shared state.

## Why Vercel KV?

[Vercel KV](https://vercel.com/docs/storage/vercel-kv) is a serverless Redis database that is accessible from every function invocation with sub-millisecond latency. Replacing the in-memory `RoomManager` with a KV-backed adapter gives you:

- **Shared state** — all API routes (`join`, `leave`, `poll`, `signal`, `status`) see the same clients and rooms.
- **Persistence** — state survives cold starts and redeployments.
- **Scalability** — multiple function instances can serve requests concurrently.

## 1. Create a Vercel KV Store

1. Open the [Vercel Dashboard](https://vercel.com/dashboard) and select your project.
2. Navigate to **Storage** → **Create Database** → **KV (Redis)**.
3. Choose a name (e.g. `p2p-signaling-kv`) and a region close to your function region.
4. Click **Create**.

Vercel automatically adds the following environment variables to your project:

| Variable | Description |
|---|---|
| `KV_URL` | Redis connection URL (`rediss://…`) |
| `KV_REST_API_URL` | HTTP REST endpoint |
| `KV_REST_API_TOKEN` | Auth token for the REST endpoint |
| `KV_REST_API_READ_ONLY_TOKEN` | Read-only token |

> **Tip:** To use these variables locally, run `vercel env pull .env.local` inside the server workspace directory.

## 2. Install the Vercel KV SDK

From the server workspace directory:

```bash
cd workplaces/p2p-console-viewer-server
npm install @vercel/kv
```

## 3. Create a KV-Backed RoomManager

Create a new file `lib/kv-room-manager.js` that implements the same interface as the existing in-memory `RoomManager` but reads and writes state through Vercel KV.

Below is a reference implementation. Adapt it to match your production needs (error handling, TTLs, etc.).

```js
"use strict";

const { kv } = require("@vercel/kv");
const { v4: uuidv4 } = require("uuid");

const CLIENTS_KEY = "clients"; // Redis hash: clientId -> JSON client object
const ROOMS_KEY = "rooms"; // Redis hash: roomName -> JSON array of clientIds
const QUEUE_PREFIX = "queue:"; // Redis list per client: queue:<clientId>

class KvRoomManager {
  // ─── Client lifecycle ────────────────────────────────────────────────

  async createClient(messageBurst) {
    const id = uuidv4();
    const client = {
      id,
      room: null,
      lastSeen: Date.now(),
      rate: { tokens: messageBurst, last: Date.now() },
    };
    await kv.hset(CLIENTS_KEY, { [id]: JSON.stringify(client) });
    return id;
  }

  async removeClient(id) {
    const raw = await kv.hget(CLIENTS_KEY, id);
    if (!raw) return null;

    const client = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (client.room) {
      await this._leaveRoom(id, client);
    }
    await kv.hdel(CLIENTS_KEY, id);
    await kv.del(`${QUEUE_PREFIX}${id}`);
    return client;
  }

  async getClient(id) {
    const raw = await kv.hget(CLIENTS_KEY, id);
    if (!raw) return undefined;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  async touch(id) {
    const client = await this.getClient(id);
    if (client) {
      client.lastSeen = Date.now();
      await kv.hset(CLIENTS_KEY, { [id]: JSON.stringify(client) });
    }
  }

  // ─── Room management ─────────────────────────────────────────────────

  async joinRoom(clientId, roomName, maxRoomClients) {
    const client = await this.getClient(clientId);
    if (!client) return { error: "client-not-found" };

    if (client.room) {
      await this._leaveRoom(clientId, client);
    }

    const roomRaw = await kv.hget(ROOMS_KEY, roomName);
    const room = roomRaw
      ? typeof roomRaw === "string"
        ? JSON.parse(roomRaw)
        : roomRaw
      : [];

    if (room.length >= maxRoomClients) {
      return { error: "room-full" };
    }

    client.room = roomName;
    await kv.hset(CLIENTS_KEY, { [clientId]: JSON.stringify(client) });

    room.push(clientId);
    await kv.hset(ROOMS_KEY, { [roomName]: JSON.stringify(room) });

    const peers = room.filter((id) => id !== clientId);
    for (const peerId of peers) {
      await this._enqueue(peerId, { type: "peer-joined", peerId: clientId });
    }

    return { room: roomName, peers };
  }

  async leaveRoom(clientId) {
    const client = await this.getClient(clientId);
    if (!client || !client.room) return { error: "not-in-room" };
    return this._leaveRoom(clientId, client);
  }

  /** @private */
  async _leaveRoom(clientId, client) {
    const roomName = client.room;
    const roomRaw = await kv.hget(ROOMS_KEY, roomName);
    let room = roomRaw
      ? typeof roomRaw === "string"
        ? JSON.parse(roomRaw)
        : roomRaw
      : [];

    room = room.filter((id) => id !== clientId);

    for (const peerId of room) {
      await this._enqueue(peerId, { type: "peer-left", peerId: clientId });
    }

    if (room.length === 0) {
      await kv.hdel(ROOMS_KEY, roomName);
    } else {
      await kv.hset(ROOMS_KEY, { [roomName]: JSON.stringify(room) });
    }

    client.room = null;
    await kv.hset(CLIENTS_KEY, { [clientId]: JSON.stringify(client) });
    return { roomName };
  }

  // ─── Signaling ───────────────────────────────────────────────────────

  async routeSignal(fromId, message, maxQueueSize) {
    const sender = await this.getClient(fromId);
    if (!sender) return { error: "client-not-found" };

    const toId = message.to ? String(message.to) : null;

    if (toId) {
      const target = await this.getClient(toId);
      if (!target) return { error: "target-not-found" };
      if (!sender.room) return { error: "not-in-room" };
      if (target.room !== sender.room)
        return { error: "target-in-different-room" };

      const queueLen = await kv.llen(`${QUEUE_PREFIX}${toId}`);
      if (queueLen >= maxQueueSize) return { error: "queue-full" };

      await this._enqueue(
        toId,
        Object.assign({}, message, { from: fromId }),
      );
    } else {
      if (!sender.room) return { error: "not-in-room" };

      const roomRaw = await kv.hget(ROOMS_KEY, sender.room);
      const room = roomRaw
        ? typeof roomRaw === "string"
          ? JSON.parse(roomRaw)
          : roomRaw
        : [];

      for (const peerId of room) {
        if (peerId === fromId) continue;
        const queueLen = await kv.llen(`${QUEUE_PREFIX}${peerId}`);
        if (queueLen < maxQueueSize) {
          await this._enqueue(
            peerId,
            Object.assign({}, message, { from: fromId }),
          );
        }
      }
    }

    return { ok: true };
  }

  // ─── Polling ─────────────────────────────────────────────────────────

  async drainQueue(clientId) {
    const client = await this.getClient(clientId);
    if (!client) return null;

    const key = `${QUEUE_PREFIX}${clientId}`;
    const len = await kv.llen(key);
    if (len === 0) {
      await this.touch(clientId);
      return [];
    }

    const messages = await kv.lrange(key, 0, -1);
    await kv.del(key);
    await this.touch(clientId);
    return messages.map((m) => (typeof m === "string" ? JSON.parse(m) : m));
  }

  // ─── Housekeeping ────────────────────────────────────────────────────

  async evictStale(ttlMs) {
    const all = await kv.hgetall(CLIENTS_KEY);
    if (!all) return;

    const now = Date.now();
    for (const [id, raw] of Object.entries(all)) {
      const client = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (now - client.lastSeen > ttlMs) {
        await this.removeClient(id);
      }
    }
  }

  // ─── Observability ───────────────────────────────────────────────────

  async getStatus() {
    const allClients = await kv.hgetall(CLIENTS_KEY);
    const allRooms = await kv.hgetall(ROOMS_KEY);

    const clientIds = allClients ? Object.keys(allClients) : [];
    const roomsInfo = {};
    if (allRooms) {
      for (const [name, raw] of Object.entries(allRooms)) {
        roomsInfo[name] = typeof raw === "string" ? JSON.parse(raw) : raw;
      }
    }

    return {
      totalClients: clientIds.length,
      clients: clientIds,
      rooms: roomsInfo,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────

  /** @private */
  async _enqueue(clientId, message) {
    await kv.rpush(
      `${QUEUE_PREFIX}${clientId}`,
      JSON.stringify(message),
    );
  }
}

module.exports = { KvRoomManager };
```

## 4. Swap the Shared State Module

Edit `lib/shared-state.js` to use the new KV-backed manager:

```js
"use strict";

const { KvRoomManager } = require("./kv-room-manager.js");

/**
 * Shared RoomManager instance used by all serverless API handlers.
 * Backed by Vercel KV so state is shared across function invocations.
 */
const roomManager = new KvRoomManager();

module.exports = { roomManager };
```

Because `KvRoomManager` exposes the same method signatures as the original `RoomManager`, the API handlers (`api/join.js`, `api/leave.js`, `api/poll.js`, `api/signal.js`, `api/status.js`) require no changes — you only need to `await` the calls that are now asynchronous.

> **Note:** The existing API handlers already `await` the `RoomManager` methods, so no additional changes should be needed in most cases. If you wrote custom code that calls `RoomManager` methods synchronously, update those call sites to use `await`.

## 5. Update the API Handlers (if needed)

If any handler uses `RoomManager` methods without `await`, add it. For example:

```diff
- const result = roomManager.joinRoom(clientId, room, MAX_ROOM_CLIENTS);
+ const result = await roomManager.joinRoom(clientId, room, MAX_ROOM_CLIENTS);
```

The existing handlers in this project already follow the async pattern, so this step may not be necessary.

## 6. Deploy and Test

```bash
# Pull environment variables locally
cd workplaces/p2p-console-viewer-server
vercel env pull .env.local

# Test locally with Vercel dev
vercel dev

# Deploy
vercel --prod
```

Verify the integration by opening two browser tabs, joining the same room, and confirming that signaling messages are routed between them.

## 7. Keeping the Standalone Server

The standalone WebSocket server (`server.js`) manages state in-process and does not need Vercel KV. The KV adapter is only required for the serverless REST API routes deployed to Vercel. You can continue to run `node server.js` locally for development without any KV dependency.
