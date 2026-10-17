import type { Handler } from "@netlify/functions";
import { audit } from "../../server/audit/logger";
import { authorize, isSameOrigin } from "../../server/auth/authorize";
import { searchOverture } from "../../server/search/OvertureProvider";
import { validateSearchRequest } from "../../server/search/validation";
import { json, parseJson, safeError } from "./_shared/http";
import { allowAttempt } from "./_shared/rateLimit";

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("SEARCH_VALIDATION:")) return safeError(400, "INVALID_SEARCH_DATA");
  return safeError(502, "SEARCH_UNAVAILABLE");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");
  if (!isSameOrigin(event)) return safeError(403, "INVALID_ORIGIN");
  const session = authorize(event, ["ADMIN", "COMMERCIAL"]);
  if (!session) return safeError(403, "FORBIDDEN");
  if (!allowAttempt(`search:${session.sub}`, 12, 15 * 60_000)) return safeError(429, "TOO_MANY_REQUESTS");
  try {
    const input = validateSearchRequest(parseJson<unknown>(event.body, 6_000));
    const startedAt = Date.now();
    const candidates = searchOverture(input);
    console.info(JSON.stringify({ type: "prospect_search_completed", source: "overture_snapshot", durationMs: Date.now() - startedAt, cities: input.cities.length, segments: input.segments.length, results: candidates.length }));
    audit("PROSPECT_SEARCHED", session.sub, undefined, { cities: input.cities, segments: input.segments, results: candidates.length });
    return json(200, { candidates });
  } catch (error) {
    console.error(JSON.stringify({ type: "operational_error", scope: "search-leads", code: error instanceof Error ? error.message.split(":")[0] : "UNKNOWN" }));
    return mapError(error);
  }
};
