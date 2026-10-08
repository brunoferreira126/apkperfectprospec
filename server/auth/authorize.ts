import type { HandlerEvent } from "@netlify/functions";
import { getCookie, SESSION_COOKIE, verifySession, type Role, type SessionPayload } from "./session.ts";

export function authorize(event: HandlerEvent, allowed: Role[] = ["ADMIN", "COMMERCIAL", "VIEWER"]): SessionPayload | null {
  const token = getCookie(event.headers.cookie, SESSION_COOKIE);
  const session = verifySession(token);
  return session && allowed.includes(session.role) ? session : null;
}

export function isSameOrigin(event: HandlerEvent): boolean {
  const origin = event.headers.origin;
  const host = event.headers.host;
  if (!origin || !host) return false;
  try {
    const originUrl = new URL(origin);
    if (originUrl.host === host) return true;
    const forwardedHost = event.headers["x-forwarded-host"]?.split(",")[0]?.trim();
    if (forwardedHost && originUrl.host === forwardedHost) return true;
    const localNames = new Set(["localhost", "127.0.0.1", "[::1]"]);
    const requestHostname = new URL(`http://${host}`).hostname;
    return localNames.has(originUrl.hostname) && localNames.has(requestHostname);
  } catch {
    return false;
  }
}
