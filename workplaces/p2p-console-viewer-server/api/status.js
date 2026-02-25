import { roomManager } from "../lib/shared-state.js";

/**
 * Factory that returns a `GET /api/status` handler backed by `roomManager`.
 *
 * Response: `{ totalClients: number, clients: string[], rooms: object }`
 *
 * @param {import('../lib/room-manager').RoomManager} rm
 * @returns {(request: Request) => Promise<Response>}
 */
export function createStatusHandler(rm) {
  return async (request) => {
    try {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "method-not-allowed" }), { status: 405 });
      }

      console.log("Status request from:", request.headers.get("x-forwarded-for") ?? "unknown");
      return new Response(JSON.stringify(rm.getStatus()), { status: 200 });
    } catch (err) {
      console.error("status handler error:", err);
      return new Response(JSON.stringify({ error: "internal-error" }), { status: 500 });
    }
  };
}

const _statusHandler = createStatusHandler(roomManager);

export default async function GET(request) {
  return _statusHandler(request);
}
