import places from "./data/overture-places.json" with { type: "json" };
import { qualifyProspect } from "./qualification.ts";
import { deduplicateProspects } from "./deduplication.ts";
import { normalizeSearchText } from "./normalization.ts";
import type { SearchProvider } from "./SearchProvider.ts";
import type { ProspectCandidate, SearchProviderResult, SearchRequest } from "./types.ts";
import { assessmentScore, phoneOwnershipIndex, verifyPlace, type VerifiablePlace } from "./verification.ts";

interface OverturePlace extends VerifiablePlace {
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
const phoneOwners = phoneOwnershipIndex(catalog);

export function searchOvertureDetailed(input: SearchRequest): SearchProviderResult {
  const cities = new Set(input.cities);
  const segments = new Set(input.segments);
  const keywords = (input.keywords ?? []).map(normalizeSearchText).filter(Boolean);

  const matched = catalog
    .filter((place) => cities.has(place.city) && segments.has(place.segment))
    .filter((place) => !keywords.length || keywords.some((keyword) => normalizeSearchText(`${place.name} ${place.segment} ${place.address ?? ""}`).includes(keyword)))
    .map((place) => {
      const phone = place.phone ?? undefined;
      const website = place.website ?? undefined;
      const instagram = place.instagram ?? undefined;
      const publicAddress = place.address ?? undefined;
      const { verification, assessment } = verifyPlace(place, phoneOwners);
      const qualification = qualifyProspect({
        companyName: place.name,
        segment: place.segment,
        city: place.city,
        phone,
        website,
        instagram,
        address: publicAddress,
      });
      const signals = [
        verification.classification === "qualified" ? "Identidade e endereço consistentes na fonte" : "Revisão de dados necessária",
        verification.phone.status === "conflict" ? "Telefone divergente" : verification.phone.status === "public_unverified" ? "Telefone público — WhatsApp não confirmado" : "Contato direto ainda não localizado",
        website ? "Site associado pela fonte; confirmar vínculo" : "Sem site identificado — oportunidade digital",
        instagram ? "Instagram associado pela fonte; confirmar perfil" : "Instagram não localizado",
        ...(verification.publicEntity ? ["Possível contratação pública"] : []),
      ];

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
        opportunityScore: assessmentScore(assessment),
        signals,
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
        source: "Overture Maps" as const,
      };
    });
  const deduplicated = deduplicateProspects(matched);
  const sorted = deduplicated.candidates
    .sort((left, right) => right.opportunityScore - left.opportunityScore || left.companyName.localeCompare(right.companyName, "pt-BR"));
  const candidates = sorted.slice(0, 160);
  return {
    candidates,
    stats: {
      found: matched.length,
      valid: sorted.filter((candidate) => candidate.verification.classification !== "discarded").length,
      duplicates: deduplicated.duplicates,
      discarded: sorted.filter((candidate) => candidate.verification.classification === "discarded").length,
      returned: candidates.length,
    },
  };
}

export function searchOverture(input: SearchRequest): ProspectCandidate[] {
  return searchOvertureDetailed(input).candidates;
}

export const overtureProvider: SearchProvider = { id: "overture_snapshot", search: searchOvertureDetailed };
