/**
 * Centralised guardrail configuration.
 * Every value can be overridden via environment variables so the same
 * binary can be tuned at deploy time without a code change.
 */

/** Maximum WebSocket frame / REST body size in bytes. */
export const MAX_PAYLOAD = parseInt(process.env.MAX_PAYLOAD || String(64 * 1024), 10);
/** Hard cap on total simultaneous connected clients. */
export const MAX_CLIENTS = parseInt(process.env.MAX_CLIENTS || "1000", 10);
/** Maximum clients allowed inside a single room. */
export const MAX_ROOM_CLIENTS = parseInt(process.env.MAX_ROOM_CLIENTS || "50", 10);
/** Token-bucket refill rate (messages per second). */
export const MESSAGE_RATE_PER_SEC = parseFloat(process.env.MESSAGE_RATE_PER_SEC || "10");
/** Token-bucket burst capacity. */
export const MESSAGE_BURST = parseFloat(process.env.MESSAGE_BURST || "20");
/** WebSocket heartbeat interval in milliseconds. */
export const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || "30000", 10);
/** Optional shared secret – clients must pass ?token=<secret> to connect. */
export const WS_SECRET = process.env.WS_SECRET || "";
/** Comma-separated list of allowed Origin headers (empty = allow all). */
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
/** Milliseconds of inactivity before a REST client is evicted. */
export const CLIENT_TTL = parseInt(process.env.CLIENT_TTL || "60000", 10);
/** Maximum pending messages per client queue. */
export const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || "100", 10);
