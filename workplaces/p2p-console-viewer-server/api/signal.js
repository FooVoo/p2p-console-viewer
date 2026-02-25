"use strict";

const { rateAllow } = require("../lib/validation.js");
const { MESSAGE_BURST, MESSAGE_RATE_PER_SEC, MAX_QUEUE_SIZE } = require("../lib/guardrails.js");

/**
 * Factory that returns a `POST /api/signal` handler backed by `roomManager`.
 *
 * Clients use this endpoint to forward WebRTC signaling payloads
 * (offer / answer / ice-candidate) or any custom message to a peer.
 * Unicast when `to` is set; broadcast to the room otherwise.
 *
 * Request body: `{ id: string, type: string, to?: string, ...payload }`
 * Response:     `{ ok: true }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(req: object, res: object) => void}
 */
function createSignalHandler(roomManager) {
  return (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ error: "method-not-allowed" });
        return;
      }

      const body = req.body || {};

      // Guard against prototype-pollution payloads.
      if (
        Object.prototype.hasOwnProperty.call(body, "__proto__") ||
        Object.prototype.hasOwnProperty.call(body, "constructor") ||
        Object.prototype.hasOwnProperty.call(body, "prototype")
      ) {
        res.status(400).json({ error: "invalid-message" });
        return;
      }

      const { id, ...message } = body;

      if (!id || typeof id !== "string") {
        res.status(400).json({ error: "invalid-id" });
        return;
      }

      if (!message.type || typeof message.type !== "string") {
        res.status(400).json({ error: "invalid-message" });
        return;
      }

      const client = roomManager.getClient(id);
      if (!client) {
        res.status(404).json({ error: "client-not-found" });
        return;
      }

      if (!rateAllow(client.rate, MESSAGE_BURST, MESSAGE_RATE_PER_SEC)) {
        res.status(429).json({ error: "rate-limit" });
        return;
      }

      const result = roomManager.routeSignal(id, message, MAX_QUEUE_SIZE);

      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error("signal handler error:", err);
      res.status(500).json({ error: "internal-error" });
    }
  };
}

const { roomManager } = require("../lib/shared-state.js");
module.exports = createSignalHandler(roomManager);
module.exports.createSignalHandler = createSignalHandler;
