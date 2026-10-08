const attempts = new Map<string, number[]>();

export function allowAttempt(key: string, limit = 5, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((timestamp) => timestamp > now - windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
}
