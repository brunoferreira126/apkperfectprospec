import type { Handler } from "@netlify/functions";
import { audit } from "../../server/audit/logger";
import { verifyPassword } from "../../server/auth/password";
import { createSession, isSecureRequest, sessionCookie } from "../../server/auth/session";
import { json, parseJson, safeError } from "./_shared/http";
import { allowAttempt } from "./_shared/rateLimit";

interface LoginInput { email?: unknown; password?: unknown }

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");

  const ip = event.headers["x-nf-client-connection-ip"] ?? event.headers["x-forwarded-for"]?.split(",")[0] ?? "unknown";
  if (!allowAttempt(`login:${ip}`)) return safeError(429, "TOO_MANY_ATTEMPTS");

  const input = parseJson<LoginInput>(event.body);
  if (!input || typeof input.email !== "string" || typeof input.password !== "string" || input.password.length > 256) {
    return safeError(400, "INVALID_CREDENTIALS");
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminEmail || !passwordHash) return safeError(503, "AUTH_NOT_CONFIGURED");

  const email = input.email.trim().toLowerCase();
  const valid = email === adminEmail && verifyPassword(input.password, passwordHash);
  if (!valid) {
    audit("LOGIN_FAILED", "anonymous", undefined, { ip });
    return safeError(401, "INVALID_CREDENTIALS");
  }

  const token = createSession(adminEmail, "ADMIN");
  audit("LOGIN", adminEmail, undefined, { role: "ADMIN" });
  return json(
    200,
    { user: { id: adminEmail, name: "Bruno", role: "ADMIN" } },
    { "set-cookie": sessionCookie(token, isSecureRequest(event.headers)) },
  );
};
