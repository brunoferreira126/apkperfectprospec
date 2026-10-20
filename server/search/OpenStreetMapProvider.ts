import { scoreProspect } from "./scoring.ts";
import { qualifyProspect } from "./qualification.ts";
import type { ProspectCandidate, SearchRequest } from "./types.ts";
import { assessmentScore, phoneOwnershipIndex, verifyPlace } from "./verification.ts";

interface OsmElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse { elements?: OsmElement[] }

const endpoints = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
const retryableStatuses = new Set([429, 502, 503, 504]);
const attemptTimeoutMs = 9_000;
const searchBudgetMs = 24_000;
const maxAttemptsPerCity = 2;
const maxConcurrentCities = 2;

class OverpassAttemptError extends Error {
  readonly kind: string;
  readonly status?: number;

  constructor(message: string, kind: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const cityBounds: Record<string, string> = {
  Cascavel: "-4.5014681,-38.4474702,-4.0060000,-38.1475871",
  Pindoretama: "-4.1035659,-38.3702716,-4.0108534,-38.2355550",
  Aquiraz: "-4.0784554,-38.5358511,-3.8190930,-38.2230000",
  "Eusébio": "-3.9380515,-38.5088371,-3.8015505,-38.4093960",
};

const clauses: Record<string, string[]> = {
  "Clínicas e consultórios": ['["amenity"~"^(clinic|doctors|dentist|veterinary)$"]', '["healthcare"]'],
  "Estética e beleza": ['["shop"~"^(beauty|hairdresser|massage)$"]', '["leisure"="spa"]'],
  "Restaurantes": ['["amenity"~"^(restaurant|cafe|fast_food|bar)$"]'],
  "Pousadas e hotéis": ['["tourism"~"^(hotel|guest_house|hostel|resort|chalet)$"]'],
  "Imobiliárias": ['["office"="estate_agent"]'],
  "Academias": ['["leisure"~"^(fitness_centre|sports_centre)$"]'],
  "Escolas e cursos": ['["amenity"~"^(school|college|language_school|training)$"]'],
  "Lojas e comércio local": ['["shop"]'],
  "Turismo e experiências": ['["tourism"~"^(attraction|museum|theme_park|gallery|information)$"]'],
  "Serviços automotivos": ['["shop"~"^(car|car_repair|tyres|motorcycle)$"]', '["amenity"="car_wash"]'],
};

function buildQuery(city: string, segments: string[]): string {
  const filters = [...new Set(segments.flatMap((segment) => clauses[segment] ?? []))];
  const searches = filters.map((filter) => `nwr${filter};`).join("\n");
  return `[out:json][timeout:20][bbox:${cityBounds[city]}];
(
${searches}
);
out center 80;`;
}

function first(tags: Record<string, string>, keys: string[]): string | undefined {
  return keys.map((key) => tags[key]?.trim()).find(Boolean);
}

function segmentFor(tags: Record<string, string>, selected: string[]): string {
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";
  const tourism = tags.tourism ?? "";
  const leisure = tags.leisure ?? "";
  const matches: Record<string, boolean> = {
    "Clínicas e consultórios": /clinic|doctors|dentist|veterinary/.test(amenity) || Boolean(tags.healthcare),
    "Estética e beleza": /beauty|hairdresser|massage/.test(shop) || leisure === "spa",
    "Restaurantes": /restaurant|cafe|fast_food|bar/.test(amenity),
    "Pousadas e hotéis": /hotel|guest_house|hostel|resort|chalet/.test(tourism),
    "Imobiliárias": tags.office === "estate_agent",
    "Academias": /fitness_centre|sports_centre/.test(leisure),
    "Escolas e cursos": /school|college|language_school|training/.test(amenity),
    "Lojas e comércio local": Boolean(shop),
    "Turismo e experiências": /attraction|museum|theme_park|gallery|information/.test(tourism),
    "Serviços automotivos": /car|car_repair|tyres|motorcycle/.test(shop) || amenity === "car_wash",
  };
  return selected.find((segment) => matches[segment]) ?? selected[0] ?? "Comércio local";
}

function address(tags: Record<string, string>): string | undefined {
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ");
  const district = tags["addr:suburb"] ?? tags["addr:neighbourhood"];
  return [street, district].filter(Boolean).join(" — ") || undefined;
}

async function requestCity(endpoint: string, city: string, segments: string[], timeoutMs: number): Promise<ProspectCandidate[]> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "PerfectProspect/0.1 (internal commercial prospecting pilot)",
      },
      body: new URLSearchParams({ data: buildQuery(city, segments) }),
    });
    if (!response.ok) throw new OverpassAttemptError(`OSM_API:${response.status}`, retryableStatuses.has(response.status) ? "upstream_busy" : "http_error", response.status);
    let body: OverpassResponse;
    try { body = await response.json() as OverpassResponse; }
    catch { throw new OverpassAttemptError("OSM_INVALID_RESPONSE", "invalid_response"); }
    return (body.elements ?? []).flatMap((element) => {
      const tags = element.tags ?? {};
      const companyName = first(tags, ["name", "brand", "operator"]);
      if (!companyName) return [];
      const phone = first(tags, ["contact:whatsapp", "contact:phone", "phone", "mobile"]);
      const website = first(tags, ["contact:website", "website"]);
      const instagram = first(tags, ["contact:instagram", "instagram"]);
      const segment = segmentFor(tags, segments);
      const publicAddress = address(tags);
      const scored = scoreProspect({ phone, website, businessStatus: "OPERATIONAL" });
      const qualification = qualifyProspect({ companyName, segment, city, phone, website, instagram, address: publicAddress });
      const latitude = element.lat ?? element.center?.lat;
      const longitude = element.lon ?? element.center?.lon;
      const verifiable = { id: `osm:${element.type}:${element.id}`, name: companyName, segment, city, address: publicAddress, phone, website, instagram, latitude, longitude, confidence: 0.7 };
      const { verification, assessment } = verifyPlace(verifiable, phoneOwnershipIndex([verifiable]));
      if (instagram) scored.signals.push("Instagram público disponível");
      return [{
        externalId: `osm:${element.type}:${element.id}`,
        companyName,
        segment,
        city,
        address: publicAddress,
        phone,
        website,
        instagram,
        mapsUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        opportunityScore: assessmentScore(assessment),
        signals: [...scored.signals, "Dados colaborativos do OpenStreetMap"],
        verification,
        commercialAssessment: assessment,
        qualification: {
          identifiedProblem: qualification.identifiedProblem,
          opportunity: qualification.opportunity,
          recommendedOffer: qualification.recommendedOffer,
          tone: qualification.tone,
          contactRoute: qualification.contactRoute,
          approachMessage: qualification.approachMessage,
        },
        source: "OpenStreetMap" as const,
      }];
    });
  } catch (error) {
    if (error instanceof OverpassAttemptError) throw error;
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new OverpassAttemptError("OSM_TIMEOUT", "timeout");
    }
    throw new OverpassAttemptError("OSM_NETWORK_ERROR", "network");
  }
}

async function searchCity(city: string, segments: string[], cityIndex: number, deadline: number): Promise<{ candidates: ProspectCandidate[]; succeeded: boolean }> {
  const orderedEndpoints = endpoints.map((_, index) => endpoints[(index + cityIndex) % endpoints.length]);
  for (let attempt = 0; attempt < maxAttemptsPerCity; attempt += 1) {
    const endpoint = orderedEndpoints[attempt];
    const remaining = deadline - Date.now();
    if (remaining < 1_000) break;
    const startedAt = Date.now();
    try {
      const candidates = await requestCity(endpoint, city, segments, Math.min(attemptTimeoutMs, remaining));
      if (attempt > 0) console.info(JSON.stringify({ type: "overpass_fallback_recovered", endpointHost: new URL(endpoint).host, city, attempt: attempt + 1, durationMs: Date.now() - startedAt }));
      return { candidates, succeeded: true };
    } catch (error) {
      const failure = error instanceof OverpassAttemptError ? error : new OverpassAttemptError("OSM_UNKNOWN", "unknown");
      console.warn(JSON.stringify({
        type: "overpass_attempt_failed",
        endpointHost: new URL(endpoint).host,
        city,
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        status: failure.status ?? null,
        failureKind: failure.kind,
      }));
      if (failure.status !== undefined && !retryableStatuses.has(failure.status)) break;
    }
  }
  return { candidates: [], succeeded: false };
}

export async function searchOpenStreetMap(input: SearchRequest): Promise<ProspectCandidate[]> {
  const deadline = Date.now() + searchBudgetMs;
  const cityResults: Array<{ candidates: ProspectCandidate[]; succeeded: boolean } | undefined> = new Array(input.cities.length);
  let nextCityIndex = 0;
  async function worker() {
    while (true) {
      const cityIndex = nextCityIndex;
      nextCityIndex += 1;
      if (cityIndex >= input.cities.length || Date.now() >= deadline) return;
      cityResults[cityIndex] = await searchCity(input.cities[cityIndex], input.segments, cityIndex, deadline);
    }
  }
  await Promise.all(Array.from({ length: Math.min(maxConcurrentCities, input.cities.length) }, () => worker()));
  const completed = cityResults.filter((result): result is { candidates: ProspectCandidate[]; succeeded: boolean } => Boolean(result));
  if (!completed.some((result) => result.succeeded)) throw new Error("OSM_ALL_ENDPOINTS_FAILED");
  const candidates = completed.flatMap((result) => result.candidates);
  return [...new Map(candidates.map((candidate) => [candidate.externalId, candidate])).values()]
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.companyName.localeCompare(b.companyName, "pt-BR"))
    .slice(0, 160);
}
