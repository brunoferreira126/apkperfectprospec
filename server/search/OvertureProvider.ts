import places from "./data/overture-places.json" with { type: "json" };
import { scoreProspect } from "./scoring.ts";
import { qualifyProspect } from "./qualification.ts";
import type { ProspectCandidate, SearchRequest } from "./types.ts";

interface OverturePlace {
  id: string;
  name: string;
  segment: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  latitude: number;
  longitude: number;
  confidence?: number | null;
}

const catalog = places as OverturePlace[];

export function searchOverture(input: SearchRequest): ProspectCandidate[] {
  const cities = new Set(input.cities);
  const segments = new Set(input.segments);

  return catalog
    .filter((place) => cities.has(place.city) && segments.has(place.segment))
    .map((place) => {
      const phone = place.phone ?? undefined;
      const website = place.website ?? undefined;
      const instagram = place.instagram ?? undefined;
      const publicAddress = place.address ?? undefined;
      const scored = scoreProspect({ phone, website, businessStatus: "OPERATIONAL" });
      const qualification = qualifyProspect({
        companyName: place.name,
        segment: place.segment,
        city: place.city,
        phone,
        website,
        instagram,
        address: publicAddress,
      });
      if (instagram) scored.signals.push("Instagram público disponível");
      if ((place.confidence ?? 0) >= 0.8) scored.signals.push("Registro com alta confiança na fonte");

      const coordinates = `${place.latitude},${place.longitude}`;
      return {
        externalId: `overture:${place.id}`,
        companyName: place.name,
        segment: place.segment,
        city: place.city,
        address: publicAddress,
        phone,
        website,
        instagram,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`,
        opportunityScore: qualification.score,
        signals: [...scored.signals, "Estabelecimento real do catálogo aberto Overture Maps"],
        qualification: {
          identifiedProblem: qualification.identifiedProblem,
          opportunity: qualification.opportunity,
          recommendedOffer: qualification.recommendedOffer,
          tone: qualification.tone,
          contactRoute: qualification.contactRoute,
          approachMessage: qualification.approachMessage,
        },
        source: "Overture Maps" as const,
      };
    })
    .sort((left, right) => right.opportunityScore - left.opportunityScore || left.companyName.localeCompare(right.companyName, "pt-BR"))
    .slice(0, 160);
}
