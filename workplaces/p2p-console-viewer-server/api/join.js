import { isValidRoomName } from "../lib/validation.js";
import { MAX_CLIENTS, MAX_ROOM_CLIENTS, MESSAGE_BURST } from "../lib/guardrails.js";
import { roomManager } from "../lib/shared-state.js";

/**
 * Factory that returns a `POST /api/join` handler backed by `roomManager`.
 *
 * Request body: `{ room: string }`
 * Response:     `{ id: string, room: string, peers: string[] }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(request: Request) => Promise<Response>}
 */
export function createJoinHandler(roomManager) {
  return async (request) => {
    try {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "method-not-allowed" }), { status: 405 });
      }

      const body = await request.json().catch(() => ({}));
      const { room } = body;

      if (!isValidRoomName(room)) {
        return new Response(JSON.stringify({ error: "invalid-room-name" }), { status: 400 });
      }

      if (roomManager.getClientCount() >= MAX_CLIENTS) {
        return new Response(JSON.stringify({ error: "server-overloaded" }), { status: 503 });
      }

      const id = roomManager.createClient(MESSAGE_BURST);
      const result = roomManager.joinRoom(id, room, MAX_ROOM_CLIENTS);

      if (result.error) {
        roomManager.removeClient(id);
        return new Response(JSON.stringify({ error: result.error }), { status: 409 });
      }

      return new Response(JSON.stringify({ id, room: result.room, peers: result.peers }), { status: 200 });
    } catch (err) {
      console.error("join handler error:", err);
      return new Response(JSON.stringify({ error: "internal-error" }), { status: 500 });
    }
  };
}

const _joinHandler = createJoinHandler(roomManager);

export default {
  fetch(request) {
    return _joinHandler(request);
  },
};
