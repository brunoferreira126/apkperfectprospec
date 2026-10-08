import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreProspect } from "../server/search/scoring.ts";
import { qualifyProspect } from "../server/search/qualification.ts";
import { validateSearchRequest } from "../server/search/validation.ts";

describe("busca de oportunidades", () => {
  it("aceita regiões e segmentos autorizados", () => {
    assert.deepEqual(validateSearchRequest({ cities: ["Aquiraz", "Eusébio"], segments: ["Restaurantes"] }), {
      cities: ["Aquiraz", "Eusébio"], segments: ["Restaurantes"],
    });
  });

  it("rejeita cidades fora das regiões atendidas", () => {
    assert.throws(() => validateSearchRequest({ cities: ["Fortaleza"], segments: ["Restaurantes"] }), /SEARCH_VALIDATION:city/);
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
});
