import { CLIENT_TTL } from "../lib/guardrails.js";
import { roomManager } from "../lib/shared-state.js";

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
 * @param {import('../lib/room-manager').RoomManager} rm
 * @returns {(request: Request) => Promise<Response>}
 */
export function createPollHandler(rm) {
  return async (request) => {
    try {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "method-not-allowed" }), { status: 405 });
      }

      const id = new URL(request.url).searchParams.get("id");

      if (!id || typeof id !== "string") {
        return new Response(JSON.stringify({ error: "invalid-id" }), { status: 400 });
      }

      rm.evictStale(CLIENT_TTL);

      const messages = rm.drainQueue(id);

      if (messages === null) {
        return new Response(JSON.stringify({ error: "client-not-found" }), { status: 404 });
      }

      return new Response(JSON.stringify({ messages }), { status: 200 });
    } catch (err) {
      console.error("poll handler error:", err);
      return new Response(JSON.stringify({ error: "internal-error" }), { status: 500 });
    }
  };
}

const _pollHandler = createPollHandler(roomManager);

export default async function GET(request) {
  return _pollHandler(request);
}
