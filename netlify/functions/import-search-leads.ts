import type { Handler } from "@netlify/functions";
import { audit } from "../../server/audit/logger";
import { authorize, isSameOrigin } from "../../server/auth/authorize";
import { createInteractionRepository, createLeadRepository } from "../../server/repositories/factory";
import { validateCreateLead } from "../../server/leads/validation";
import { qualifyProspect } from "../../server/search/qualification";
import { json, parseJson, safeError } from "./_shared/http";
import { allowAttempt } from "./_shared/rateLimit";

interface ImportCandidate {
  externalId?: unknown; companyName?: unknown; segment?: unknown; city?: unknown; phone?: unknown;
  website?: unknown; instagram?: unknown; mapsUrl?: unknown; address?: unknown; signals?: unknown; source?: unknown;
}

function candidateToLead(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("VALIDATION:candidate");
  const candidate = value as ImportCandidate;
  const signals = Array.isArray(candidate.signals) ? candidate.signals.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  const base = validateCreateLead({
    companyName: candidate.companyName,
    segment: candidate.segment,
    city: candidate.city,
    source: candidate.source === "Google Places" ? "Google Places" : "OpenStreetMap",
    externalId: candidate.externalId,
    sourceUrl: candidate.mapsUrl,
    status: "contact_ready",
    whatsapp: candidate.phone,
    website: candidate.website,
    instagram: candidate.instagram,
  });
  const qualification = qualifyProspect({
    companyName: base.companyName,
    segment: base.segment,
    city: base.city,
    phone: base.whatsapp,
    website: base.website,
    instagram: base.instagram,
    address: typeof candidate.address === "string" ? candidate.address : undefined,
  });
  const notes = [
    typeof candidate.address === "string" ? `Endereço público: ${candidate.address}` : "",
    signals.length ? `Sinais preliminares: ${signals.join("; ")}` : "",
    `Tom sugerido: ${qualification.tone}`,
    `Canal recomendado: ${qualification.contactRoute}`,
    "Lead pré-qualificado automaticamente e aprovado por uma pessoa antes de entrar no CRM.",
  ].filter(Boolean).join("\n");
  const now = new Date().toISOString();
  return {
    ...base,
    notes,
    score: qualification.score,
    scoreBreakdown: qualification.scoreBreakdown,
    analysis: {
      summary: qualification.summary,
      identifiedProblem: qualification.identifiedProblem,
      opportunity: qualification.opportunity,
      recommendedOffer: qualification.recommendedOffer,
      reasoning: qualification.reasoning,
      analyzedAt: now,
    },
    generatedMessage: qualification.approachMessage,
    messageGeneratedAt: now,
  };
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");
  if (!isSameOrigin(event)) return safeError(403, "INVALID_ORIGIN");
  const session = authorize(event, ["ADMIN", "COMMERCIAL"]);
  if (!session) return safeError(403, "FORBIDDEN");
  if (!allowAttempt(`import-search:${session.sub}`, 10, 15 * 60_000)) return safeError(429, "TOO_MANY_REQUESTS");
  try {
    const body = parseJson<{ candidates?: unknown[] }>(event.body, 80_000);
    if (!body?.candidates || !Array.isArray(body.candidates) || body.candidates.length < 1 || body.candidates.length > 40) return safeError(400, "INVALID_IMPORT_DATA");
    const inputs = body.candidates.map(candidateToLead);
    const leads = createLeadRepository();
    const interactions = createInteractionRepository();
    const existing = await leads.list();
    const known = new Set(existing.map((lead) => lead.externalId).filter(Boolean));
    const imported = [];
    const skipped: string[] = [];
    for (const input of inputs) {
      if (input.externalId && known.has(input.externalId)) { skipped.push(input.externalId); continue; }
      const lead = await leads.create(input);
      await interactions.append({ leadId: lead.id, type: "LEAD_CREATED", occurredAt: lead.createdAt, actorId: session.sub, metadata: { source: lead.source, imported: true, automaticallyQualified: true } });
      imported.push(lead);
      if (lead.externalId) known.add(lead.externalId);
    }
    audit("SEARCH_RESULTS_IMPORTED", session.sub, undefined, { imported: imported.length, skipped: skipped.length });
    return json(201, { leads: imported, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("VALIDATION:")) return safeError(400, "INVALID_IMPORT_DATA");
    if (message.startsWith("DRIVE_CONFIGURATION_MISSING")) return safeError(503, "STORAGE_NOT_CONFIGURED");
    console.error(JSON.stringify({ type: "operational_error", scope: "import-search-leads", code: message.split(":")[0] || "UNKNOWN" }));
    return safeError(502, "IMPORT_UNAVAILABLE");
  }
};
