import { createHmac, timingSafeEqual } from "node:crypto";

export type Role = "ADMIN" | "COMMERCIAL" | "VIEWER";

export interface SessionPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE = "pp_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET_NOT_CONFIGURED");
  return value;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(userId: string, role: Role): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: userId, role, iat: now, exp: now + SESSION_TTL_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySession(token?: string): SessionPayload | null {
  if (!token) return null;
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) return null;

  const expected = Buffer.from(sign(encoded));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || !payload.role || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!["ADMIN", "COMMERCIAL", "VIEWER"].includes(payload.role)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCookie(cookieHeader: string | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([key]) => key === name)?.[1];
}

function secureAttribute(secure: boolean): string {
  return secure ? "; Secure" : "";
}

export function sessionCookie(token: string, secure = true): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly${secureAttribute(secure)}; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookie(secure = true): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly${secureAttribute(secure)}; SameSite=Strict; Max-Age=0`;
}

export function isSecureRequest(headers: Record<string, string | undefined>): boolean {
  const forwardedProtocol = headers["x-forwarded-proto"]?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProtocol) return forwardedProtocol === "https";

  const origin = headers.origin;
  if (origin) {
    try {
      return new URL(origin).protocol === "https:";
    } catch {
      // An invalid Origin must not make the cookie less restrictive.
    }
  }

  return true;
}
