import type { HandlerResponse } from "@netlify/functions";

export const securityHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function json(statusCode: number, body: unknown, headers: Record<string, string> = {}): HandlerResponse {
  return { statusCode, headers: { ...securityHeaders, ...headers }, body: JSON.stringify(body) };
}

export function safeError(statusCode = 500, code = "INTERNAL_ERROR"): HandlerResponse {
  return json(statusCode, { error: code });
}

export function parseJson<T>(raw: string | null, maxBytes = 4_096): T | null {
  if (!raw || Buffer.byteLength(raw, "utf8") > maxBytes) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
