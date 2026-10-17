import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreProspect } from "../server/search/scoring.ts";
import { qualifyProspect } from "../server/search/qualification.ts";
import { searchOverture } from "../server/search/OvertureProvider.ts";
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
});
