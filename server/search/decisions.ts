import type { ProspectDecisionRecord } from "../repositories/ProspectDecisionRepository";
import type { ProspectCandidate } from "./types.ts";

export function applyProspectDecisions(candidates: ProspectCandidate[], decisions: ProspectDecisionRecord[]): ProspectCandidate[] {
  const byExternalId = new Map(decisions.map((record) => [record.externalId, record]));
  const visible: ProspectCandidate[] = [];
  for (const candidate of candidates) {
    const decision = byExternalId.get(candidate.externalId);
    if (!decision) { visible.push(candidate); continue; }
    const unchanged = decision.latest.fingerprint === candidate.verification.fingerprint;
    if (unchanged && ["approved", "rejected"].includes(decision.latest.action)) continue;
    if (unchanged && decision.latest.action === "contact_invalidated") {
      visible.push({
        ...candidate,
        verification: {
          ...candidate.verification,
          classification: "pending",
          phone: { status: "invalid", reason: decision.latest.reason },
          uncertainties: [...candidate.verification.uncertainties, `Contato invalidado por decisão humana: ${decision.latest.reason}`],
        },
        commercialAssessment: { ...candidate.commercialAssessment, contactReliability: 0 },
        signals: ["Contato invalidado — localizar outro canal", ...candidate.signals.filter((signal) => !signal.toLocaleLowerCase("pt-BR").includes("telefone"))],
      });
      continue;
    }
    visible.push({ ...candidate, verification: { ...candidate.verification, revaluationReason: "Os dados públicos mudaram desde a última decisão; revisar novamente." } });
  }
  return visible;
}
