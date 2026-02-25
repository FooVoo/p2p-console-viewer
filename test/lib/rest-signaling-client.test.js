import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RestSignalingClient } from "../../workplaces/p2p-console-viewer-lib/src/rest-signaling-client.js";

// ── Mock P2PConnection ──────────────────────────────────────────────────────
vi.mock(
  "../../workplaces/p2p-console-viewer-lib/src/p2p-connection.js",
  () => ({
    P2PConnection: class MockP2PConnection {
      constructor() {
        this.iceCandidateHandlers = [];
        this.offerHandlers = [];
        this.answerHandlers = [];
        this.messageHandlers = [];
        this.connectedHandlers = [];
        this.disconnectedHandlers = [];
      }

      onIceCandidate(handler) {
        this.iceCandidateHandlers.push(handler);
      }
      onOffer(handler) {
        this.offerHandlers.push(handler);
      }
      onAnswer(handler) {
        this.answerHandlers.push(handler);
      }
      onMessage(handler) {
        this.messageHandlers.push(handler);
      }
      onConnected(handler) {
        this.connectedHandlers.push(handler);
      }
      onDisconnected(handler) {
        this.disconnectedHandlers.push(handler);
      }

      async initiate() {
        const offer = { type: "offer", sdp: "mock-offer-sdp" };
        this.offerHandlers.forEach((h) => h(offer));
        return offer;
      }
      async receiveOffer(offer) {
        const answer = { type: "answer", sdp: "mock-answer-sdp" };
        this.answerHandlers.forEach((h) => h(answer));
        return answer;
      }
      async receiveAnswer() {}
      async addIceCandidate() {}
      send() {
        return true;
      }
      close() {}
    },
  }),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a RestSignalingClient whose RestClient methods are replaced by stubs.
 * Returns { client, stubs } so the test can control what each endpoint returns.
 */
function createClientWithStubs(baseUrl = "https://signal.example.com", opts = {}) {
  const client = new RestSignalingClient(baseUrl, opts);

  const stubs = {
    get: vi.fn().mockResolvedValue({ messages: [] }),
    post: vi.fn().mockResolvedValue({ ok: true }),
  };

  client.rest.get = stubs.get;
  client.rest.post = stubs.post;

  return { client, stubs };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RestSignalingClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should create an instance with default options", () => {
      const client = new RestSignalingClient("https://example.com");
      expect(client.rest).toBeDefined();
      expect(client.peers).toBeInstanceOf(Map);
      expect(client.currentServerID).toBeNull();
      expect(client.currentRoom).toBeNull();
      expect(client.roomPeers).toEqual([]);
      expect(client.pollIntervalMs).toBe(2000);
      expect(client._connected).toBe(false);
    });

    it("should accept custom pollIntervalMs", () => {
      const client = new RestSignalingClient("https://example.com", {
        pollIntervalMs: 500,
      });
      expect(client.pollIntervalMs).toBe(500);
    });
  });

  // ── connect ──────────────────────────────────────────────────────────────

  describe("connect", () => {
    it("should POST /api/join and store server state", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "client-1",
        room: "lobby",
        peers: ["peer-a"],
      });

      const result = await client.connect({ room: "lobby" });

      expect(stubs.post).toHaveBeenCalledWith("/api/join", { room: "lobby" });
      expect(result).toEqual({
        id: "client-1",
        room: "lobby",
        peers: ["peer-a"],
      });
      expect(client.currentServerID).toBe("client-1");
      expect(client.currentRoom).toBe("lobby");
      expect(client.roomPeers).toEqual(["peer-a"]);
      expect(client._connected).toBe(true);
    });

    it("should start polling after successful connect", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "client-1",
        room: "r",
        peers: [],
      });

      await client.connect({ room: "r" });

      // Advance timers to trigger a poll
      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(stubs.get).toHaveBeenCalledWith("/api/poll", {
        params: { id: "client-1" },
      });
    });

    it("should throw when room name is missing", async () => {
      const { client } = createClientWithStubs();
      await expect(client.connect({})).rejects.toThrow(
        "Valid room name is required",
      );
    });

    it("should throw when room name is empty string", async () => {
      const { client } = createClientWithStubs();
      await expect(client.connect({ room: "" })).rejects.toThrow(
        "Valid room name is required",
      );
    });

    it("should emit error and throw on REST failure", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockRejectedValueOnce(new Error("Network error"));

      const errorHandler = vi.fn();
      client.onError(errorHandler);

      await expect(client.connect({ room: "r" })).rejects.toThrow(
        "Network error",
      );
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  // ── disconnect ───────────────────────────────────────────────────────────

  describe("disconnect", () => {
    it("should POST /api/leave and reset state", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });

      await client.connect({ room: "r" });
      stubs.post.mockResolvedValueOnce({ ok: true });

      await client.disconnect();

      expect(stubs.post).toHaveBeenCalledWith("/api/leave", { id: "c1" });
      expect(client.currentServerID).toBeNull();
      expect(client.currentRoom).toBeNull();
      expect(client.roomPeers).toEqual([]);
      expect(client._connected).toBe(false);
    });

    it("should close all peer connections on disconnect", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      const p2p = client.createP2PConnection("peer-a");
      const closeSpy = vi.spyOn(p2p, "close");

      stubs.post.mockResolvedValueOnce({ ok: true });
      await client.disconnect();

      expect(closeSpy).toHaveBeenCalled();
      expect(client.peers.size).toBe(0);
    });

    it("should stop polling on disconnect", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      stubs.post.mockResolvedValueOnce({ ok: true });
      await client.disconnect();

      stubs.get.mockClear();
      await vi.advanceTimersByTimeAsync(5000);

      // No further polls should have been made
      expect(stubs.get).not.toHaveBeenCalled();
    });

    it("should tolerate a leave request failure", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      stubs.post.mockRejectedValueOnce(new Error("gone"));

      // Should not throw
      await expect(client.disconnect()).resolves.toBeUndefined();
      expect(client._connected).toBe(false);
    });
  });

  // ── Polling & message routing ────────────────────────────────────────────

  describe("polling", () => {
    it("should route offer messages to P2PConnection", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      stubs.get.mockResolvedValueOnce({
        messages: [
          {
            type: "offer",
            from: "peer-b",
            offer: { type: "offer", sdp: "sdp" },
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(client.peers.has("peer-b")).toBe(true);
    });

    it("should route answer messages to existing peer", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      const p2p = client.createP2PConnection("peer-b");
      const receiveAnswerSpy = vi.spyOn(p2p, "receiveAnswer");

      stubs.get.mockResolvedValueOnce({
        messages: [
          {
            type: "answer",
            from: "peer-b",
            answer: { type: "answer", sdp: "sdp" },
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(receiveAnswerSpy).toHaveBeenCalledWith({
        type: "answer",
        sdp: "sdp",
      });
    });

    it("should route ice-candidate messages to existing peer", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      const p2p = client.createP2PConnection("peer-b");
      const addIceSpy = vi.spyOn(p2p, "addIceCandidate");

      stubs.get.mockResolvedValueOnce({
        messages: [
          {
            type: "ice-candidate",
            from: "peer-b",
            candidate: { candidate: "abc" },
          },
        ],
      });

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(addIceSpy).toHaveBeenCalledWith({ candidate: "abc" });
    });

    it("should handle peer-joined messages", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      stubs.get.mockResolvedValueOnce({
        messages: [{ type: "peer-joined", peerId: "new-peer" }],
      });

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(client.roomPeers).toContain("new-peer");
    });

    it("should not add duplicate peers on peer-joined", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: ["existing"],
      });
      await client.connect({ room: "r" });

      stubs.get.mockResolvedValueOnce({
        messages: [{ type: "peer-joined", peerId: "existing" }],
      });

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(client.roomPeers.filter((p) => p === "existing")).toHaveLength(1);
    });

    it("should handle peer-left messages and clean up P2P connection", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: ["peer-b"],
      });
      await client.connect({ room: "r" });

      const p2p = client.createP2PConnection("peer-b");
      const closeSpy = vi.spyOn(p2p, "close");

      stubs.get.mockResolvedValueOnce({
        messages: [{ type: "peer-left", peerId: "peer-b" }],
      });

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(client.roomPeers).not.toContain("peer-b");
      expect(closeSpy).toHaveBeenCalled();
      expect(client.peers.has("peer-b")).toBe(false);
    });

    it("should handle error messages from server", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      const errorHandler = vi.fn();
      client.onError(errorHandler);

      stubs.get.mockResolvedValueOnce({
        messages: [{ type: "error", message: "rate-limit" }],
      });

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: "rate-limit" }),
      );
    });

    it("should emit error when poll request fails", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      const errorHandler = vi.fn();
      client.onError(errorHandler);

      stubs.get.mockRejectedValueOnce(new Error("timeout"));

      await vi.advanceTimersByTimeAsync(client.pollIntervalMs + 10);

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Poll failed") }),
      );
    });
  });

  // ── Signaling (outbound) ─────────────────────────────────────────────────

  describe("_sendSignal", () => {
    it("should POST /api/signal with client id", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      stubs.post.mockResolvedValueOnce({ ok: true });

      await client._sendSignal({
        type: "offer",
        to: "peer-x",
        offer: { sdp: "x" },
      });

      expect(stubs.post).toHaveBeenCalledWith("/api/signal", {
        id: "c1",
        type: "offer",
        to: "peer-x",
        offer: { sdp: "x" },
      });
    });

    it("should throw when not connected", async () => {
      const { client } = createClientWithStubs();
      await expect(
        client._sendSignal({ type: "offer" }),
      ).rejects.toThrow("Not connected");
    });
  });

  // ── initiateP2P ──────────────────────────────────────────────────────────

  describe("initiateP2P", () => {
    it("should create connection and return offer", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });

      stubs.post.mockResolvedValue({ ok: true });

      const offer = await client.initiateP2P("remote");

      expect(client.peers.has("remote")).toBe(true);
      expect(offer).toEqual({ type: "offer", sdp: "mock-offer-sdp" });
    });

    it("should reject invalid remotePeerId", async () => {
      const { client } = createClientWithStubs();
      await expect(client.initiateP2P("")).rejects.toThrow(
        "Valid remotePeerId is required",
      );
    });

    it("should reject null remotePeerId", async () => {
      const { client } = createClientWithStubs();
      await expect(client.initiateP2P(null)).rejects.toThrow(
        "Valid remotePeerId is required",
      );
    });
  });

  // ── sendMessage ──────────────────────────────────────────────────────────

  describe("sendMessage", () => {
    it("should send to a specific peer", async () => {
      const { client } = createClientWithStubs();
      const p2p = client.createP2PConnection("peer-a");
      const sendSpy = vi.spyOn(p2p, "send");

      client.sendMessage("peer-a", { text: "hi" });

      expect(sendSpy).toHaveBeenCalledWith({ text: "hi" });
    });

    it("should send to first peer when only payload given", async () => {
      const { client } = createClientWithStubs();
      const p2p = client.createP2PConnection("peer-a");
      const sendSpy = vi.spyOn(p2p, "send");

      client.sendMessage({ text: "hi" });

      expect(sendSpy).toHaveBeenCalledWith({ text: "hi" });
    });

    it("should return false for unknown peer", () => {
      const { client } = createClientWithStubs();
      expect(client.sendMessage("ghost", "msg")).toBe(false);
    });

    it("should return false when no peers exist and only payload given", () => {
      const { client } = createClientWithStubs();
      expect(client.sendMessage("msg")).toBe(false);
    });
  });

  // ── disconnectPeer ───────────────────────────────────────────────────────

  describe("disconnectPeer", () => {
    it("should close and remove a peer", () => {
      const { client } = createClientWithStubs();
      const p2p = client.createP2PConnection("peer-a");
      const closeSpy = vi.spyOn(p2p, "close");

      client.disconnectPeer("peer-a");

      expect(closeSpy).toHaveBeenCalled();
      expect(client.peers.has("peer-a")).toBe(false);
    });

    it("should be a no-op for unknown peer", () => {
      const { client } = createClientWithStubs();
      expect(() => client.disconnectPeer("unknown")).not.toThrow();
    });
  });

  // ── getRoomPeers ─────────────────────────────────────────────────────────

  describe("getRoomPeers", () => {
    it("should return a copy of roomPeers", () => {
      const { client } = createClientWithStubs();
      client.roomPeers = ["a", "b"];

      const peers = client.getRoomPeers();

      expect(peers).toEqual(["a", "b"]);
      expect(peers).not.toBe(client.roomPeers);
    });
  });

  // ── isConnected ──────────────────────────────────────────────────────────

  describe("isConnected", () => {
    it("should return false before connect", () => {
      const { client } = createClientWithStubs();
      expect(client.isConnected()).toBe(false);
    });

    it("should return true after connect", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });
      expect(client.isConnected()).toBe(true);
    });

    it("should return false after disconnect", async () => {
      const { client, stubs } = createClientWithStubs();
      stubs.post.mockResolvedValueOnce({
        id: "c1",
        room: "r",
        peers: [],
      });
      await client.connect({ room: "r" });
      stubs.post.mockResolvedValueOnce({ ok: true });
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  // ── Error & peer-error handlers ──────────────────────────────────────────

  describe("error handlers", () => {
    it("should invoke onError handlers", () => {
      const { client } = createClientWithStubs();
      const handler = vi.fn();
      client.onError(handler);

      client.emitError(new Error("boom"));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    });

    it("should invoke onPeerError handlers", () => {
      const { client } = createClientWithStubs();
      const handler = vi.fn();
      client.onPeerError(handler);

      client.emitPeerError("peer-x", new Error("fail"));

      expect(handler).toHaveBeenCalledWith("peer-x", expect.objectContaining({ message: "fail" }));
    });

    it("should tolerate a throwing error handler", () => {
      const { client } = createClientWithStubs();
      client.onError(() => {
        throw new Error("handler crash");
      });
      const second = vi.fn();
      client.onError(second);

      client.emitError(new Error("oops"));

      expect(second).toHaveBeenCalled();
    });
  });

  // ── Peer message handlers ────────────────────────────────────────────────

  describe("peer message handlers", () => {
    it("should forward P2P data channel messages to handlers", () => {
      const { client } = createClientWithStubs();
      const handler = vi.fn();
      client.onPeerMessage(handler);

      const p2p = client.createP2PConnection("peer-x");
      // Simulate a data channel message
      p2p.messageHandlers.forEach((h) => h("hello"));

      expect(handler).toHaveBeenCalledWith("peer-x", "hello");
    });
  });

  // ── handleSignalingMessage edge cases ────────────────────────────────────

  describe("handleSignalingMessage edge cases", () => {
    it("should warn on offer without from field", () => {
      const { client } = createClientWithStubs();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      client.handleSignalingMessage({ type: "offer", offer: {} });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should warn on answer without from field", () => {
      const { client } = createClientWithStubs();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      client.handleSignalingMessage({ type: "answer", answer: {} });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should warn on answer for unknown peer", () => {
      const { client } = createClientWithStubs();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      client.handleSignalingMessage({
        type: "answer",
        from: "ghost",
        answer: {},
      });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should warn on ice-candidate without from field", () => {
      const { client } = createClientWithStubs();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      client.handleSignalingMessage({
        type: "ice-candidate",
        candidate: {},
      });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should warn on ice-candidate for unknown peer", () => {
      const { client } = createClientWithStubs();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      client.handleSignalingMessage({
        type: "ice-candidate",
        from: "ghost",
        candidate: {},
      });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should log unknown message types", () => {
      const { client } = createClientWithStubs();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      client.handleSignalingMessage({ type: "custom-unknown" });

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  // ── createP2PConnection ──────────────────────────────────────────────────

  describe("createP2PConnection", () => {
    it("should reuse existing connection for same peer", () => {
      const { client } = createClientWithStubs();
      const p1 = client.createP2PConnection("peer-a");
      const p2 = client.createP2PConnection("peer-a");
      expect(p1).toBe(p2);
    });
  });
});
