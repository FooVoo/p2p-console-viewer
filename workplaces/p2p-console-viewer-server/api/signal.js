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
 * @returns {(request: Request) => Promise<Response>}
 */
function createSignalHandler(roomManager) {
  return async (request) => {
    try {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "method-not-allowed" }), { status: 405 });
      }

      const body = await request.json().catch(() => ({}));

      // Guard against prototype-pollution payloads.
      if (
        Object.prototype.hasOwnProperty.call(body, "__proto__") ||
        Object.prototype.hasOwnProperty.call(body, "constructor") ||
        Object.prototype.hasOwnProperty.call(body, "prototype")
      ) {
        return new Response(JSON.stringify({ error: "invalid-message" }), { status: 400 });
      }

      const { id, ...message } = body;

      if (!id || typeof id !== "string") {
        return new Response(JSON.stringify({ error: "invalid-id" }), { status: 400 });
      }

      if (!message.type || typeof message.type !== "string") {
        return new Response(JSON.stringify({ error: "invalid-message" }), { status: 400 });
      }

      const client = roomManager.getClient(id);
      if (!client) {
        return new Response(JSON.stringify({ error: "client-not-found" }), { status: 404 });
      }

      if (!rateAllow(client.rate, MESSAGE_BURST, MESSAGE_RATE_PER_SEC)) {
        return new Response(JSON.stringify({ error: "rate-limit" }), { status: 429 });
      }

      const result = roomManager.routeSignal(id, message, MAX_QUEUE_SIZE);

      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), { status: 400 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      console.error("signal handler error:", err);
      return new Response(JSON.stringify({ error: "internal-error" }), { status: 500 });
    }
  };
}

const { roomManager } = require("../lib/shared-state.js");
const _signalHandler = createSignalHandler(roomManager);

async function POST(request) {
  return _signalHandler(request);
}

module.exports = POST;
module.exports.POST = POST;
module.exports.createSignalHandler = createSignalHandler;
