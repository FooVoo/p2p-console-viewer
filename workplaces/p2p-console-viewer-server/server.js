import { createJoinHandler } from "./api/join.js";
import { createLeaveHandler } from "./api/leave.js";
import { createSignalHandler } from "./api/signal.js";
import { createPollHandler } from "./api/poll.js";
import { createStatusHandler } from "./api/status.js";
import { RoomManager } from "./lib/room-manager.js";

const roomManager = new RoomManager();

const join = createJoinHandler(roomManager);
const leave = createLeaveHandler(roomManager);
const signal = createSignalHandler(roomManager);
const poll = createPollHandler(roomManager);
const status = createStatusHandler(roomManager);

export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/join") return join(request);
    if (pathname === "/api/leave") return leave(request);
    if (pathname === "/api/signal") return signal(request);
    if (pathname === "/api/poll") return poll(request);
    if (pathname === "/api/status") return status(request);

    return new Response("Not Found", { status: 404 });
  },
};
