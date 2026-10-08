import type { Handler } from "@netlify/functions";
import { audit } from "../../server/audit/logger";
import { authorize, isSameOrigin } from "../../server/auth/authorize";
import { clearSessionCookie, isSecureRequest } from "../../server/auth/session";
import { json, safeError } from "./_shared/http";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");
  if (!isSameOrigin(event)) return safeError(403, "INVALID_ORIGIN");
  const session = authorize(event);
  if (session) audit("LOGOUT", session.sub);
  return json(200, { ok: true }, { "set-cookie": clearSessionCookie(isSecureRequest(event.headers)) });
};
