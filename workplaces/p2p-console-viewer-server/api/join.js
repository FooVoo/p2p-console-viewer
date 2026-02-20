"use strict";

const { isValidRoomName } = require("../lib/validation.js");
const { MAX_CLIENTS, MAX_ROOM_CLIENTS, MESSAGE_BURST } = require("../lib/guardrails.js");

/**
 * Factory that returns a `POST /api/join` handler backed by `roomManager`.
 *
 * Request body: `{ room: string }`
 * Response:     `{ id: string, room: string, peers: string[] }`
 *
 * @param {import('../lib/room-manager').RoomManager} roomManager
 * @returns {(req: object, res: object) => void}
 */
function createJoinHandler(roomManager) {
  return (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method-not-allowed" });
      return;
    }

    const { room } = req.body || {};

    if (!isValidRoomName(room)) {
      res.status(400).json({ error: "invalid-room-name" });
      return;
    }

    if (roomManager.clients.size >= MAX_CLIENTS) {
      res.status(503).json({ error: "server-overloaded" });
      return;
    }

    const id = roomManager.createClient(MESSAGE_BURST);
    const result = roomManager.joinRoom(id, room, MAX_ROOM_CLIENTS);

    if (result.error) {
      roomManager.removeClient(id);
      res.status(409).json({ error: result.error });
      return;
    }

    res.status(200).json({ id, room: result.room, peers: result.peers });
  };
}

const { roomManager } = require("../lib/shared-state.js");
module.exports = createJoinHandler(roomManager);
module.exports.createJoinHandler = createJoinHandler;
