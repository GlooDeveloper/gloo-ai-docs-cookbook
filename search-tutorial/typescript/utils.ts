export function normalizeLimit(
  value: unknown,
  fallback: number = 10,
  min: number = 1,
  max: number = 100
): number {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
