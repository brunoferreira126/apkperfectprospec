import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreProspect } from "../server/search/scoring.ts";
import { qualifyProspect } from "../server/search/qualification.ts";
import { searchOverture } from "../server/search/OvertureProvider.ts";
import { searchOvertureDetailed } from "../server/search/OvertureProvider.ts";
import { validateSearchRequest } from "../server/search/validation.ts";
import { applyProspectDecisions } from "../server/search/decisions.ts";
import { deduplicateProspects } from "../server/search/deduplication.ts";
import { normalizeDomain, normalizePhone, normalizeSearchText } from "../server/search/normalization.ts";
import { assessmentScore, phoneOwnershipIndex, verifyPlace, type VerifiablePlace } from "../server/search/verification.ts";
import { prospectsToCsv } from "../src/lib/prospectCsv.ts";
import { whatsappUrl } from "../src/lib/whatsapp.ts";

describe("busca de oportunidades", () => {
  it("aceita regiões e segmentos autorizados", () => {
    assert.deepEqual(validateSearchRequest({ cities: ["Aquiraz", "Eusébio"], segments: ["Restaurantes"] }), {
      cities: ["Aquiraz", "Eusébio"], segments: ["Restaurantes"],
    });
  });

  it("rejeita cidades fora das regiões atendidas", () => {
    assert.throws(() => validateSearchRequest({ cities: ["Fortaleza"], segments: ["Restaurantes"] }), /SEARCH_VALIDATION:city/);
  });

  it("normaliza texto, telefone e domínio sem perder a identidade comercial", () => {
    assert.equal(normalizeSearchText("  Eusébio — CE  "), "eusebio ce");
    assert.equal(normalizePhone("+55 (85) 99999-0000"), "85999990000");
    assert.equal(normalizeDomain("https://www.Exemplo.com.br/contato"), "exemplo.com.br");
  });

  it("valida até oito palavras-chave e rejeita entradas excessivas", () => {
    assert.deepEqual(validateSearchRequest({ cities: ["Cascavel"], segments: ["Restaurantes"], keywords: ["  café  ", "café", "pizza"] }).keywords, ["café", "pizza"]);
    assert.throws(() => validateSearchRequest({ cities: ["Cascavel"], segments: ["Restaurantes"], keywords: Array.from({ length: 9 }, (_, index) => `termo ${index}`) }), /SEARCH_VALIDATION:keywords/);
  });

  it("prioriza empresa ativa com contato e oportunidade digital", () => {
    const strong = scoreProspect({ phone: "(85) 99999-9999", rating: 4.7, reviewCount: 150, businessStatus: "OPERATIONAL" });
    const weak = scoreProspect({ website: "https://example.com", reviewCount: 2 });
    assert.ok(strong.score > weak.score);
    assert.ok(strong.signals.includes("Sem site identificado — oportunidade digital"));
  });

  it("pré-qualifica e prepara uma abordagem sem depender de API paga", () => {
    const result = qualifyProspect({
      companyName: "Espaço Exemplo",
      segment: "Estética e beleza",
      city: "Eusébio",
      phone: "(85) 99999-9999",
    });
    assert.ok(result.score >= 60);
    assert.equal(result.recommendedOffer, "Perfect Link");
    assert.match(result.approachMessage, /Bruno Mendes/);
    assert.match(result.approachMessage, /Espaço Exemplo/);
    assert.match(result.contactRoute, /WhatsApp/);
  });

  it("retorna estabelecimentos reais do recorte de Cascavel sem depender da rede", () => {
    const results = searchOverture({ cities: ["Cascavel"], segments: ["Clínicas e consultórios"] });
    assert.ok(results.length > 0);
    assert.ok(results.every((candidate) => candidate.city === "Cascavel"));
    assert.ok(results.every((candidate) => candidate.segment === "Clínicas e consultórios"));
    assert.ok(results.every((candidate) => candidate.source === "Overture Maps"));
    assert.ok(results.every((candidate) => candidate.externalId.startsWith("overture:")));
    assert.ok(results.some((candidate) => Boolean(candidate.phone)));
  });

  it("filtra várias cidades e segmentos e limita a resposta", () => {
    const results = searchOverture({ cities: ["Pindoretama", "Eusébio"], segments: ["Restaurantes", "Imobiliárias"] });
    assert.ok(results.length > 0);
    assert.ok(results.length <= 160);
    assert.ok(results.every((candidate) => ["Pindoretama", "Eusébio"].includes(candidate.city)));
    assert.ok(results.every((candidate) => ["Restaurantes", "Imobiliárias"].includes(candidate.segment)));
    assert.equal(new Set(results.map((candidate) => candidate.externalId)).size, results.length);
  });

  it("filtra por múltiplas palavras-chave e informa métricas auditáveis", () => {
    const baseline = searchOvertureDetailed({ cities: ["Cascavel"], segments: ["Restaurantes"] });
    const named = baseline.candidates[0];
    assert.ok(named);
    const token = normalizeSearchText(named.companyName).split(" ").find((part) => part.length >= 4);
    assert.ok(token);
    const result = searchOvertureDetailed({ cities: ["Cascavel"], segments: ["Restaurantes"], keywords: [token] });
    assert.ok(result.candidates.length > 0);
    assert.ok(result.candidates.every((candidate) => normalizeSearchText(`${candidate.companyName} ${candidate.segment} ${candidate.address ?? ""}`).includes(token)));
    assert.equal(result.stats.returned, result.candidates.length);
    assert.ok(result.stats.found >= result.stats.returned);
  });

  it("remove somente duplicatas com evidência forte e preserva homônimos", () => {
    const original = searchOverture({ cities: ["Cascavel"], segments: ["Clínicas e consultórios"] }).find((candidate) => candidate.phone);
    assert.ok(original);
    const duplicate = { ...original, externalId: "outra-fonte:1", opportunityScore: original.opportunityScore + 1 };
    const homonym = { ...original, externalId: "outra-fonte:2", phone: "(85) 98888-7777", website: undefined, address: "Outro endereço, Cascavel" };
    const result = deduplicateProspects([original, duplicate, homonym]);
    assert.equal(result.duplicates, 1);
    assert.equal(result.candidates.length, 2);
    assert.ok(result.candidates.some((candidate) => candidate.externalId === homonym.externalId));
  });

  it("exporta CSV UTF-8 com estados de verificação e neutraliza fórmulas", () => {
    const candidate = searchOverture({ cities: ["Cascavel"], segments: ["Clínicas e consultórios"] })[0];
    assert.ok(candidate);
    const csv = prospectsToCsv([{ ...candidate, companyName: "=EMPRESA-PERIGOSA" }]);
    assert.ok(csv.startsWith("\uFEFF"));
    assert.match(csv, /Estado do telefone/);
    assert.match(csv, /Pendente de decisão humana/);
    assert.match(csv, /'=EMPRESA-PERIGOSA/);
  });

  it("gera link brasileiro do WhatsApp com mensagem sem enviar automaticamente", () => {
    assert.equal(whatsappUrl("(85) 99999-0000", "Olá, tudo bem?"), "https://wa.me/5585999990000?text=Ol%C3%A1%2C%20tudo%20bem%3F");
    assert.equal(whatsappUrl("+55 85 99999-0000"), "https://wa.me/5585999990000");
  });

  it("não trata telefone divergente como contato validado", () => {
    const places: VerifiablePlace[] = [
      { id: "1", name: "Clínica Alfa", segment: "Clínicas e consultórios", city: "Cascavel", address: "Centro, Cascavel", phone: "(85) 99999-0000", latitude: -4.1, longitude: -38.2, confidence: 0.9 },
      { id: "2", name: "Restaurante Beta", segment: "Restaurantes", city: "Cascavel", address: "Centro, Cascavel", phone: "85 99999-0000", latitude: -4.2, longitude: -38.3, confidence: 0.9 },
    ];
    const result = verifyPlace(places[0], phoneOwnershipIndex(places), "2026-10-19T12:00:00.000Z");
    assert.equal(result.verification.phone.status, "conflict");
    assert.equal(result.assessment.contactReliability, 0);
    assert.equal(result.verification.classification, "pending");
  });

  it("mantém Instagram sem associação como não confirmado e endereço inconsistente em revisão", () => {
    const place: VerifiablePlace = { id: "3", name: "Clínica Alfa", segment: "Clínicas e consultórios", city: "Eusébio", address: "Centro, Fortaleza", instagram: "https://instagram.com/perfil_aleatorio", latitude: -3.9, longitude: -38.4, confidence: 0.9 };
    const result = verifyPlace(place, phoneOwnershipIndex([place]), "2026-10-19T12:00:00.000Z");
    assert.equal(result.verification.instagram.status, "unverified");
    assert.equal(result.verification.address.status, "inconsistent");
    assert.equal(result.verification.classification, "pending");
  });

  it("sinaliza órgão público e limita a prioridade comercial", () => {
    const place: VerifiablePlace = { id: "4", name: "Secretaria Municipal de Turismo", segment: "Turismo e experiências", city: "Aquiraz", address: "Centro, Aquiraz", phone: "(85) 3333-0000", latitude: -3.9, longitude: -38.3, confidence: 0.95 };
    const result = verifyPlace(place, phoneOwnershipIndex([place]), "2026-10-19T12:00:00.000Z");
    assert.equal(result.verification.publicEntity, true);
    assert.equal(result.assessment.procurementRestriction, "public_procurement");
    assert.ok(assessmentScore(result.assessment) <= 35);
    assert.equal(result.verification.classification, "pending");
  });

  it("oculta reprovação sem mudança e reabre quando a evidência muda", () => {
    const candidate = searchOverture({ cities: ["Cascavel"], segments: ["Clínicas e consultórios"] })[0];
    assert.ok(candidate);
    const event = { id: "decision-1", action: "rejected" as const, scope: "company" as const, reason: "Sem oportunidade verificável", fingerprint: candidate.verification.fingerprint, actorId: "admin", occurredAt: "2026-10-19T12:00:00.000Z" };
    const decision = { externalId: candidate.externalId, latest: event, history: [event], updatedAt: event.occurredAt };
    assert.equal(applyProspectDecisions([candidate], [decision]).length, 0);
    const changed = { ...candidate, verification: { ...candidate.verification, fingerprint: "f".repeat(64) } };
    const reconsidered = applyProspectDecisions([changed], [decision]);
    assert.equal(reconsidered.length, 1);
    assert.match(reconsidered[0].verification.revaluationReason ?? "", /mudaram/i);
  });

  it("invalida somente o contato sem descartar a empresa", () => {
    const candidate = searchOverture({ cities: ["Cascavel"], segments: ["Clínicas e consultórios"] }).find((item) => item.phone);
    assert.ok(candidate);
    const event = { id: "decision-2", action: "contact_invalidated" as const, scope: "contact" as const, reason: "Telefone pertence a outra empresa", fingerprint: candidate.verification.fingerprint, actorId: "admin", occurredAt: "2026-10-19T12:00:00.000Z" };
    const [result] = applyProspectDecisions([candidate], [{ externalId: candidate.externalId, latest: event, history: [event], updatedAt: event.occurredAt }]);
    assert.equal(result.verification.phone.status, "invalid");
    assert.equal(result.verification.classification, "pending");
    assert.equal(result.commercialAssessment.contactReliability, 0);
  });
});
