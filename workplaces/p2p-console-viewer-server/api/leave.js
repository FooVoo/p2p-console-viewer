"use strict";

/**
 * Factory that returns a `POST /api/leave` handler backed by `roomManager`.
 *
 * Request body: `{ id: string }`
 * Response:     `{ ok: true }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(req: object, res: object) => void}
 */
function createLeaveHandler(roomManager) {
  return (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    const { id } = req.body || {};

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "invalid-id" });
      return;
    }

    roomManager.removeClient(id);
    res.status(200).json({ ok: true });
  };
}

const { roomManager } = require("../lib/shared-state.js");
module.exports = createLeaveHandler(roomManager);
module.exports.createLeaveHandler = createLeaveHandler;
