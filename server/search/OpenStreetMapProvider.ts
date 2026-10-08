import { scoreProspect } from "./scoring.ts";
import { qualifyProspect } from "./qualification.ts";
import type { ProspectCandidate, SearchRequest } from "./types.ts";

interface OsmElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse { elements?: OsmElement[] }

const endpoint = "https://overpass-api.de/api/interpreter";

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

async function searchCity(city: string, segments: string[]): Promise<ProspectCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        "user-agent": "PerfectProspect/0.1 (internal commercial prospecting pilot)",
      },
      body: new URLSearchParams({ data: buildQuery(city, segments) }),
    });
    if (!response.ok) throw new Error(`OSM_API:${response.status}`);
    const body = await response.json() as OverpassResponse;
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
        opportunityScore: qualification.score,
        signals: [...scored.signals, "Dados colaborativos do OpenStreetMap"],
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
  } finally { clearTimeout(timeout); }
}

export async function searchOpenStreetMap(input: SearchRequest): Promise<ProspectCandidate[]> {
  const candidates: ProspectCandidate[] = [];
  for (const city of input.cities) candidates.push(...await searchCity(city, input.segments));
  return [...new Map(candidates.map((candidate) => [candidate.externalId, candidate])).values()]
    .sort((a, b) => b.opportunityScore - a.opportunityScore || a.companyName.localeCompare(b.companyName, "pt-BR"))
    .slice(0, 160);
}
