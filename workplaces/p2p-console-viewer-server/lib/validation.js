"use strict";

/**
 * Returns true when `name` is a safe room identifier (alphanumeric, hyphens,
 * underscores, 1–64 characters); false for any other input.
 * @param {*} name
 * @returns {boolean}
 */
function isValidRoomName(name) {
  return typeof name === "string" && /^[A-Za-z0-9\-_]{1,64}$/.test(name);
}

/**
 * Token-bucket rate limiter.  Mutates `rate` in-place and returns whether
 * the current request should be allowed.
 *
 * @param {{ tokens: number, last: number }} rate  - Mutable bucket state.
 * @param {number} burst      - Maximum token capacity.
 * @param {number} ratePerSec - Token refill rate (tokens / second).
 * @returns {boolean}
 */
function rateAllow(rate, burst, ratePerSec) {
  const now = Date.now();
  const elapsed = Math.max(0, (now - rate.last) / 1000);
  rate.tokens = Math.min(burst, rate.tokens + elapsed * ratePerSec);
  rate.last = now;
  if (rate.tokens >= 1) {
    rate.tokens -= 1;
    return true;
  }
  return false;
}

module.exports = { isValidRoomName, rateAllow };
