import type { Handler } from "@netlify/functions";
import { audit } from "../../server/audit/logger";
import { authorize, isSameOrigin } from "../../server/auth/authorize";
import { createInteractionRepository, createLeadRepository, createProspectDecisionRepository } from "../../server/repositories/factory";
import { validateCreateLead } from "../../server/leads/validation";
import { qualifyProspect } from "../../server/search/qualification";
import { searchOverture } from "../../server/search/OvertureProvider";
import type { ProspectCandidate } from "../../server/search/types";
import { validateSearchRequest } from "../../server/search/validation";
import { json, parseJson, safeError } from "./_shared/http";
import { allowAttempt } from "./_shared/rateLimit";

function canonicalCandidates(values: unknown[]): ProspectCandidate[] {
  const requested = values.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("VALIDATION:candidate");
    const record = value as Record<string, unknown>;
    if (typeof record.externalId !== "string" || typeof record.city !== "string" || typeof record.segment !== "string") throw new Error("VALIDATION:candidate");
    return { externalId: record.externalId, city: record.city, segment: record.segment };
  });
  const request = validateSearchRequest({ cities: requested.map((item) => item.city), segments: requested.map((item) => item.segment) });
  const canonical = new Map(searchOverture(request).map((candidate) => [candidate.externalId, candidate]));
  return requested.map((item) => canonical.get(item.externalId) ?? (() => { throw new Error("VALIDATION:candidate"); })());
}

function candidateToLead(candidate: ProspectCandidate) {
  const signals = candidate.signals.slice(0, 8);
  const base = validateCreateLead({
    companyName: candidate.companyName,
    segment: candidate.segment,
    city: candidate.city,
    source: candidate.source === "Google Places" ? "Google Places" : candidate.source === "Overture Maps" ? "Overture Maps" : "OpenStreetMap",
    externalId: candidate.externalId,
    sourceUrl: candidate.mapsUrl,
    status: "qualified",
    whatsapp: candidate.verification.phone.status === "confirmed_whatsapp" ? candidate.phone : undefined,
    website: candidate.verification.website.status === "confirmed" ? candidate.website : undefined,
    instagram: candidate.verification.instagram.status === "confirmed" ? candidate.instagram : undefined,
    contactEvidence: {
      publicPhone: candidate.phone,
      phoneStatus: candidate.verification.phone.status,
      phoneReason: candidate.verification.phone.reason,
      publicInstagram: candidate.instagram,
      instagramStatus: candidate.verification.instagram.status,
      instagramReason: candidate.verification.instagram.reason,
      publicWebsite: candidate.website,
      websiteStatus: candidate.verification.website.status,
      websiteReason: candidate.verification.website.reason,
    },
  });
  const qualification = qualifyProspect({
    companyName: base.companyName,
    segment: base.segment,
    city: base.city,
    phone: candidate.phone,
    website: candidate.website,
    instagram: candidate.instagram,
    address: typeof candidate.address === "string" ? candidate.address : undefined,
  });
  const notes = [
    typeof candidate.address === "string" ? `Endereço público: ${candidate.address}` : "",
    candidate.phone ? `Telefone público (${candidate.verification.phone.status}): ${candidate.phone}` : "",
    candidate.instagram ? `Instagram associado pela fonte (${candidate.verification.instagram.status}): ${candidate.instagram}` : "",
    candidate.website ? `Site associado pela fonte (${candidate.verification.website.status}): ${candidate.website}` : "",
    signals.length ? `Sinais preliminares: ${signals.join("; ")}` : "",
    `Tom sugerido: ${qualification.tone}`,
    `Canal recomendado: ${qualification.contactRoute}`,
    "Prospect aprovado por uma pessoa para análise comercial. Canais não confirmados permanecem apenas como evidência e não são tratados como contato validado.",
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
    decisionFingerprint: candidate.verification.fingerprint,
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
    const inputs = canonicalCandidates(body.candidates).map(candidateToLead);
    const leads = createLeadRepository();
    const interactions = createInteractionRepository();
    const decisions = createProspectDecisionRepository();
    const existing = await leads.list();
    const known = new Map(existing.filter((lead) => lead.externalId).map((lead) => [lead.externalId!, lead]));
    const imported = [];
    const existingLeads = [];
    const skipped: string[] = [];
    for (const input of inputs) {
      const { decisionFingerprint, ...leadInput } = input;
      const current = leadInput.externalId ? known.get(leadInput.externalId) : undefined;
      if (current) {
        const refreshed = await leads.update(current.id, {
          expectedVersion: current.version,
          contactEvidence: leadInput.contactEvidence,
          analysis: current.analysis ?? leadInput.analysis,
          score: current.score ?? leadInput.score,
          scoreBreakdown: current.scoreBreakdown ?? leadInput.scoreBreakdown,
          generatedMessage: current.generatedMessage ?? leadInput.generatedMessage,
          messageGeneratedAt: current.messageGeneratedAt ?? leadInput.messageGeneratedAt,
        });
        existingLeads.push(refreshed);
        skipped.push(leadInput.externalId!);
        await decisions.record({ externalId: leadInput.externalId!, action: "approved", scope: "company", reason: "Aprovado novamente e recuperado no CRM.", fingerprint: decisionFingerprint, actorId: session.sub });
        continue;
      }
      const lead = await leads.create(leadInput);
      await interactions.append({ leadId: lead.id, type: "LEAD_CREATED", occurredAt: lead.createdAt, actorId: session.sub, metadata: { source: lead.source, imported: true, automaticallyQualified: true } });
      imported.push(lead);
      if (lead.externalId) {
        known.set(lead.externalId, lead);
        await decisions.record({ externalId: lead.externalId, action: "approved", scope: "company", reason: "Aprovado por uma pessoa e importado para o CRM.", fingerprint: decisionFingerprint, actorId: session.sub });
      }
    }
    audit("SEARCH_RESULTS_IMPORTED", session.sub, undefined, { imported: imported.length, skipped: skipped.length });
    return json(201, { leads: imported, existing: existingLeads, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("VALIDATION:")) return safeError(400, "INVALID_IMPORT_DATA");
    if (message.startsWith("DRIVE_CONFIGURATION_MISSING")) return safeError(503, "STORAGE_NOT_CONFIGURED");
    console.error(JSON.stringify({ type: "operational_error", scope: "import-search-leads", code: message.split(":")[0] || "UNKNOWN" }));
    return safeError(502, "IMPORT_UNAVAILABLE");
  }
};
