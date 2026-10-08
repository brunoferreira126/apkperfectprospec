import type { Handler } from "@netlify/functions";
import { OpenAIResponsesProvider } from "../../server/ai/OpenAIResponsesProvider";
import { audit } from "../../server/audit/logger";
import { authorize, isSameOrigin } from "../../server/auth/authorize";
import { activeOffers } from "../../server/config/offers";
import { calculateScore } from "../../server/config/scoring";
import { createInteractionRepository, createLeadRepository } from "../../server/repositories/factory";
import { json, parseJson, safeError } from "./_shared/http";
import { allowAttempt } from "./_shared/rateLimit";

interface AnalyzeInput { id?: unknown; expectedVersion?: unknown }
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AI_CONFIGURATION_MISSING" || message === "AI_CONFIGURATION_INVALID") return safeError(503, "AI_NOT_CONFIGURED");
  if (message === "AI_RATE_LIMITED") return safeError(429, "AI_RATE_LIMITED");
  if (message === "AI_REFUSED") return safeError(422, "AI_REFUSED");
  if (message.startsWith("AI_OUTPUT_INVALID") || message === "AI_EMPTY_RESPONSE") return safeError(502, "AI_INVALID_RESPONSE");
  if (message === "LEAD_VERSION_CONFLICT") return safeError(409, "LEAD_VERSION_CONFLICT");
  if (message.startsWith("DRIVE_CONFIGURATION_MISSING")) return safeError(503, "STORAGE_NOT_CONFIGURED");
  return safeError(502, "AI_UNAVAILABLE");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");
  if (!isSameOrigin(event)) return safeError(403, "INVALID_ORIGIN");
  const session = authorize(event, ["ADMIN", "COMMERCIAL"]);
  if (!session) return safeError(403, "FORBIDDEN");
  if (!allowAttempt(`ai:${session.sub}`, 20, 60 * 60_000)) return safeError(429, "AI_RATE_LIMITED");

  const input = parseJson<AnalyzeInput>(event.body, 2_048);
  if (!input || typeof input.id !== "string" || !idPattern.test(input.id) || !Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) {
    return safeError(400, "INVALID_REQUEST");
  }

  const leads = createLeadRepository();
  try {
    const lead = await leads.findById(input.id);
    if (!lead) return safeError(404, "LEAD_NOT_FOUND");
    if (lead.version !== Number(input.expectedVersion)) return safeError(409, "LEAD_VERSION_CONFLICT");

    audit("AI_ANALYSIS_REQUESTED", session.sub, lead.id, { version: lead.version });
    const result = await new OpenAIResponsesProvider().analyzeLead(lead, activeOffers());
    const scoreBreakdown = {
      commercialFit: result.commercialFit,
      digitalOpportunity: result.digitalOpportunity,
      decisionMakerAccess: result.decisionMakerAccess,
      activityReputation: result.activityReputation,
    };
    const score = calculateScore(scoreBreakdown);
    const now = new Date().toISOString();
    const updated = await leads.update(lead.id, {
      expectedVersion: lead.version,
      score,
      scoreBreakdown,
      analysis: {
        summary: result.summary,
        identifiedProblem: result.identifiedProblem,
        opportunity: result.opportunity,
        recommendedOffer: result.recommendedOffer,
        reasoning: result.reasoning,
        analyzedAt: now,
      },
      generatedMessage: result.approachMessage,
      messageGeneratedAt: now,
    });
    await createInteractionRepository().append({
      leadId: lead.id,
      type: "AI_ANALYSIS_COMPLETED",
      occurredAt: now,
      actorId: session.sub,
      metadata: { score, recommendedOffer: result.recommendedOffer, leadVersion: updated.version },
    });
    audit("AI_ANALYSIS_COMPLETED", session.sub, lead.id, { score, recommendedOffer: result.recommendedOffer });
    return json(200, { lead: updated });
  } catch (error) {
    console.error(JSON.stringify({ type: "operational_error", scope: "analyze_lead", code: error instanceof Error ? error.message.split(":")[0] : "UNKNOWN" }));
    return mapError(error);
  }
};
