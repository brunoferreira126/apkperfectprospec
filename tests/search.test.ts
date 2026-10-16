import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreProspect } from "../server/search/scoring.ts";
import { qualifyProspect } from "../server/search/qualification.ts";
import { searchOpenStreetMap } from "../server/search/OpenStreetMapProvider.ts";
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

  it("usa um endpoint alternativo quando o primeiro está indisponível", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    try {
      globalThis.fetch = async (input) => {
        calls.push(String(input));
        if (calls.length === 1) return new Response("upstream unavailable", { status: 502 });
        return new Response(JSON.stringify({ elements: [{ id: 123, type: "node", lat: -4.1, lon: -38.2, tags: { name: "Empresa Real", amenity: "restaurant", phone: "(85) 99999-9999" } }] }), { status: 200, headers: { "content-type": "application/json" } });
      };
      const results = await searchOpenStreetMap({ cities: ["Cascavel"], segments: ["Restaurantes"] });
      assert.equal(calls.length, 2);
      assert.equal(results[0]?.companyName, "Empresa Real");
    } finally { globalThis.fetch = originalFetch; }
  });

  it("preserva resultados de uma cidade quando outra falha", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (_input, init) => {
        const query = new URLSearchParams(String(init?.body)).get("data") ?? "";
        if (query.includes("-4.5014681")) return new Response("busy", { status: 503 });
        return new Response(JSON.stringify({ elements: [{ id: 456, type: "node", lat: -3.9, lon: -38.4, tags: { name: "Clínica Exemplo", amenity: "clinic" } }] }), { status: 200, headers: { "content-type": "application/json" } });
      };
      const results = await searchOpenStreetMap({ cities: ["Cascavel", "Eusébio"], segments: ["Clínicas e consultórios"] });
      assert.equal(results.length, 1);
      assert.equal(results[0]?.city, "Eusébio");
    } finally { globalThis.fetch = originalFetch; }
  });
});
