"use strict";

/**
 * Factory that returns a `GET /api/status` handler backed by `roomManager`.
 *
 * Response: `{ totalClients: number, clients: string[], rooms: object }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(req: object, res: object) => void}
 */
function createStatusHandler(roomManager) {
  return (req, res) => {
    try {
      if (req.method !== "GET") {
        res.status(405).json({ error: "method-not-allowed" });
        return;
      }

      console.log("Status request from:", req.socket?.remoteAddress);
      res.status(200).json(roomManager.getStatus());
    } catch (err) {
      console.error("status handler error:", err);
      res.status(500).json({ error: "internal-error" });
    }
  };
}

const { roomManager } = require("../lib/shared-state.js");
module.exports = createStatusHandler(roomManager);
module.exports.createStatusHandler = createStatusHandler;
