import { scoreProspect } from "./scoring";
import { qualifyProspect } from "./qualification";
import type { ProspectCandidate, SearchRequest } from "./types";
import { assessmentScore, phoneOwnershipIndex, verifyPlace } from "./verification";

interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
}

interface GoogleResponse { places?: GooglePlace[]; error?: { message?: string; status?: string } }

const endpoint = "https://places.googleapis.com/v1/places:searchText";
const fieldMask = [
  "places.id", "places.displayName", "places.primaryTypeDisplayName", "places.formattedAddress",
  "places.nationalPhoneNumber", "places.websiteUri", "places.googleMapsUri", "places.rating",
  "places.userRatingCount", "places.businessStatus",
].join(",");

async function searchCombination(apiKey: string, city: string, segment: string): Promise<ProspectCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({
        textQuery: `${segment} em ${city}, Ceará, Brasil`,
        languageCode: "pt-BR",
        regionCode: "BR",
        maxResultCount: 10,
      }),
    });
    const body = await response.json().catch(() => ({})) as GoogleResponse;
    if (!response.ok) throw new Error(`PLACES_API:${body.error?.status ?? response.status}`);
    return (body.places ?? []).flatMap((place) => {
      if (!place.id || !place.displayName?.text || place.businessStatus === "CLOSED_PERMANENTLY") return [];
      const scored = scoreProspect(place);
      const resolvedSegment = place.primaryTypeDisplayName?.text ?? segment;
      const qualification = qualifyProspect({
        companyName: place.displayName.text,
        segment: resolvedSegment,
        city,
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        address: place.formattedAddress,
      });
      const verifiable = { id: place.id, name: place.displayName.text, segment: resolvedSegment, city, address: place.formattedAddress, phone: place.nationalPhoneNumber, website: place.websiteUri, latitude: undefined, longitude: undefined, confidence: 0.9 };
      const { verification, assessment } = verifyPlace(verifiable, phoneOwnershipIndex([verifiable]));
      return [{
        externalId: place.id,
        companyName: place.displayName.text,
        segment: resolvedSegment,
        city,
        address: place.formattedAddress,
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        mapsUrl: place.googleMapsUri,
        rating: place.rating,
        reviewCount: place.userRatingCount,
        opportunityScore: assessmentScore(assessment),
        signals: scored.signals,
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
        source: "Google Places" as const,
      }];
    });
  } finally { clearTimeout(timeout); }
}

export async function searchGooglePlaces(input: SearchRequest): Promise<ProspectCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey || apiKey === "sua-chave-google-places") throw new Error("PLACES_NOT_CONFIGURED");
  const combinations = input.cities.flatMap((city) => input.segments.map((segment) => ({ city, segment })));
  const candidates: ProspectCandidate[] = [];
  for (let index = 0; index < combinations.length; index += 3) {
    const batch = combinations.slice(index, index + 3);
    const results = await Promise.all(batch.map(({ city, segment }) => searchCombination(apiKey, city, segment)));
    candidates.push(...results.flat());
  }
  return [...new Map(candidates.map((candidate) => [candidate.externalId, candidate])).values()]
    .sort((a, b) => b.opportunityScore - a.opportunityScore || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, 80);
}
