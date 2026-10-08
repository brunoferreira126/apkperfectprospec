import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCreateLead, validateUpdateLead } from "../server/leads/validation.ts";
import { validateAIAnalysis } from "../server/ai/validation.ts";
import { activeOffers } from "../server/config/offers.ts";
import { calculateScore, scorePriority } from "../server/config/scoring.ts";

describe("validação de leads", () => {
  it("normaliza e aceita dados comerciais válidos", () => {
    const lead = validateCreateLead({ companyName: "  Espaço   Exemplo ", segment: "Estética", city: "Eusébio", source: "Cadastro manual", website: "espaco.example", whatsapp: "+55 85 99999-9999" });
    assert.equal(lead.companyName, "Espaço Exemplo");
    assert.equal(lead.website, "https://espaco.example/");
    assert.equal(lead.status, "new");
  });

  it("rejeita protocolo inseguro no site", () => {
    assert.throws(() => validateCreateLead({ companyName: "Empresa", segment: "Serviços", city: "Aquiraz", source: "Manual", website: "javascript:alert(1)" }), /VALIDATION:website/);
  });

  it("exige versão esperada em atualizações", () => {
    assert.throws(() => validateUpdateLead({ status: "qualified" }), /VALIDATION:expectedVersion/);
    assert.deepEqual(validateUpdateLead({ expectedVersion: 2, status: "qualified" }), { expectedVersion: 2, status: "qualified" });
  });
});

describe("análise e score", () => {
  const validAnalysis = {
    commercialFit: 24,
    digitalOpportunity: 27,
    decisionMakerAccess: 20,
    activityReputation: 12,
    summary: "Empresa com aderência comercial e presença digital ativa.",
    identifiedProblem: "O caminho entre interesse e contato não está claro.",
    opportunity: "Organizar a jornada para facilitar agendamentos.",
    recommendedOffer: "Perfect Link",
    reasoning: "A oferta aproxima os canais atuais do próximo passo comercial.",
    approachMessage: "Olá! Observei uma oportunidade específica na jornada de contato. Posso compartilhar uma ideia?",
  };

  it("recalcula o total no servidor", () => {
    assert.equal(calculateScore(validAnalysis), 83);
    assert.equal(scorePriority(83), "high");
  });

  it("valida a estrutura e a oferta ativa", () => {
    assert.deepEqual(validateAIAnalysis(validAnalysis, activeOffers()), validAnalysis);
    assert.throws(() => validateAIAnalysis({ ...validAnalysis, recommendedOffer: "Oferta inventada" }, activeOffers()), /recommendedOffer/);
  });

  it("rejeita pontuação fora do limite", () => {
    assert.throws(() => validateAIAnalysis({ ...validAnalysis, commercialFit: 31 }, activeOffers()), /commercialFit/);
  });
});
