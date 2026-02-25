import { RoomManager } from "./room-manager.js";

/**
 * Shared RoomManager instance used by all serverless API handlers.
 *
 * NOTE: In a Vercel deployment each API file is its own isolated serverless
 * function, so this module-level singleton is NOT shared across routes by
 * default.  For production use, replace this with a Vercel KV (Redis) backed
 * adapter so that all handlers operate on the same persistent state.
 */
export const roomManager = new RoomManager();
