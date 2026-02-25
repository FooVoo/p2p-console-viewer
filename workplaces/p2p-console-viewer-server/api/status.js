"use strict";

/**
 * Factory that returns a `GET /api/status` handler backed by `roomManager`.
 *
 * Response: `{ totalClients: number, clients: string[], rooms: object }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(request: Request) => Promise<Response>}
 */
function createStatusHandler(roomManager) {
  return async (request) => {
    try {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "method-not-allowed" }), { status: 405 });
      }

      console.log("Status request from:", request.headers.get("x-forwarded-for") ?? "unknown");
      return new Response(JSON.stringify(roomManager.getStatus()), { status: 200 });
    } catch (err) {
      console.error("status handler error:", err);
      return new Response(JSON.stringify({ error: "internal-error" }), { status: 500 });
    }
  };
}

const { roomManager } = require("../lib/shared-state.js");
const _statusHandler = createStatusHandler(roomManager);

async function GET(request) {
  return _statusHandler(request);
}

module.exports = GET;
module.exports.GET = GET;
module.exports.createStatusHandler = createStatusHandler;
