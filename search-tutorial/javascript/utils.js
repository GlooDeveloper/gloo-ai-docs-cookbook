/**
 * Shared helpers for input normalization in CLI and server code.
 */

function normalizeLimit(value, fallback = 10, min = 1, max = 100) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

module.exports = { normalizeLimit };
