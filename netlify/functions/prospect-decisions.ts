import type { Handler } from "@netlify/functions";
import { audit } from "../../server/audit/logger";
import { authorize, isSameOrigin } from "../../server/auth/authorize";
import { createProspectDecisionRepository } from "../../server/repositories/factory";
import type { ProspectDecisionAction, ProspectDecisionScope } from "../../server/repositories/ProspectDecisionRepository";
import { json, parseJson, safeError } from "./_shared/http";
import { allowAttempt } from "./_shared/rateLimit";

const actions = new Set<ProspectDecisionAction>(["approved", "rejected", "contact_invalidated"]);
const scopes = new Set<ProspectDecisionScope>(["company", "contact"]);

function cleanText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new Error(`DECISION_VALIDATION:${field}`);
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) throw new Error(`DECISION_VALIDATION:${field}`);
  return clean;
}

function validateDecision(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DECISION_VALIDATION:payload");
  const input = value as Record<string, unknown>;
  const externalId = cleanText(input.externalId, "externalId", 180);
  const reason = cleanText(input.reason, "reason", 300);
  const fingerprint = cleanText(input.fingerprint, "fingerprint", 64);
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error("DECISION_VALIDATION:fingerprint");
  if (!actions.has(input.action as ProspectDecisionAction)) throw new Error("DECISION_VALIDATION:action");
  if (!scopes.has(input.scope as ProspectDecisionScope)) throw new Error("DECISION_VALIDATION:scope");
  const action = input.action as ProspectDecisionAction;
  const scope = input.scope as ProspectDecisionScope;
  if (action === "contact_invalidated" && scope !== "contact") throw new Error("DECISION_VALIDATION:scope");
  if (action === "rejected" && scope !== "company") throw new Error("DECISION_VALIDATION:scope");
  return { externalId, reason, fingerprint, action, scope };
}

export const handler: Handler = async (event) => {
  const session = authorize(event, ["ADMIN", "COMMERCIAL"]);
  if (!session) return safeError(403, "FORBIDDEN");
  const repository = createProspectDecisionRepository();
  try {
    if (event.httpMethod === "GET") {
      const externalId = event.queryStringParameters?.externalId?.trim();
      if (externalId && externalId.length > 180) return safeError(400, "INVALID_DECISION_DATA");
      if (externalId) return json(200, { decision: await repository.findByExternalId(externalId) });
      const decisions = await repository.list();
      return json(200, { decisions: decisions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 100) });
    }
    if (event.httpMethod !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");
    if (!isSameOrigin(event)) return safeError(403, "INVALID_ORIGIN");
    if (!allowAttempt(`decision:${session.sub}`, 120, 15 * 60_000)) return safeError(429, "TOO_MANY_REQUESTS");
    const input = validateDecision(parseJson<unknown>(event.body, 4_000));
    const decision = await repository.record({ ...input, actorId: session.sub });
    audit("PROSPECT_DECISION_RECORDED", session.sub, undefined, { externalId: input.externalId, action: input.action, scope: input.scope });
    return json(200, { decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("DECISION_VALIDATION:")) return safeError(400, "INVALID_DECISION_DATA");
    console.error(JSON.stringify({ type: "operational_error", scope: "prospect-decisions", code: message.split(":")[0] || "UNKNOWN" }));
    return safeError(502, "STORAGE_UNAVAILABLE");
  }
};
