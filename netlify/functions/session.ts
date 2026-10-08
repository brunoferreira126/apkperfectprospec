import type { Handler } from "@netlify/functions";
import { authorize } from "../../server/auth/authorize";
import { json, safeError } from "./_shared/http";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") return safeError(405, "METHOD_NOT_ALLOWED");
  const session = authorize(event);
  if (!session) return safeError(401, "UNAUTHORIZED");
  return json(200, { user: { id: session.sub, name: "Bruno", role: session.role } });
};
