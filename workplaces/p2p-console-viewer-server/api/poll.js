"use strict";

const { CLIENT_TTL } = require("../lib/guardrails.js");

/**
 * Factory that returns a `GET /api/poll` handler backed by `roomManager`.
 *
 * Clients call this endpoint periodically to receive messages that were
 * queued for them (peer-joined, peer-left, offer, answer, ice-candidate …).
 * Each call drains the queue atomically and resets the client's idle timer.
 * Stale clients (idle longer than CLIENT_TTL) are evicted on each poll.
 *
 * Query param: `id=<clientId>`
 * Response:    `{ messages: object[] }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(req: object, res: object) => void}
 */
function createPollHandler(roomManager) {
  return (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    const id = (req.query || {}).id;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "invalid-id" });
      return;
    }

    roomManager.evictStale(CLIENT_TTL);

    const messages = roomManager.drainQueue(id);

    if (messages === null) {
      res.status(404).json({ error: "client-not-found" });
      return;
    }

    res.status(200).json({ messages });
  };
}

const { roomManager } = require("../lib/shared-state.js");
module.exports = createPollHandler(roomManager);
module.exports.createPollHandler = createPollHandler;
