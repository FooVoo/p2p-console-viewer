import { roomManager } from "../lib/shared-state.js";

/**
 * Factory that returns a `POST /api/leave` handler backed by `roomManager`.
 *
 * Request body: `{ id: string }`
 * Response:     `{ ok: true }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(request: Request) => Promise<Response>}
 */
export function createLeaveHandler(roomManager) {
  return async (request) => {
    try {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "method-not-allowed" }), { status: 405 });
      }

      const body = await request.json().catch(() => ({}));
      const { id } = body;

      if (!id || typeof id !== "string") {
        return new Response(JSON.stringify({ error: "invalid-id" }), { status: 400 });
      }

      roomManager.removeClient(id);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      console.error("leave handler error:", err);
      return new Response(JSON.stringify({ error: "internal-error" }), { status: 500 });
    }
  };
}

const _leaveHandler = createLeaveHandler(roomManager);

export default {
  fetch(request) {
    return _leaveHandler(request);
  },
};
