import type { ProspectCandidate } from "./types.ts";
import { normalizeDomain, normalizePhone, normalizeSearchText } from "./normalization.ts";

function identityKeys(candidate: ProspectCandidate): string[] {
  const city = normalizeSearchText(candidate.city);
  const name = normalizeSearchText(candidate.companyName);
  const address = normalizeSearchText(candidate.address);
  const phone = normalizePhone(candidate.phone);
  const domain = normalizeDomain(candidate.website);
  return [
    `source:${candidate.externalId}`,
    domain && name ? `domain:${city}:${name}:${domain}` : "",
    phone && name ? `phone:${city}:${name}:${phone}` : "",
    name && address ? `address:${city}:${name}:${address}` : "",
  ].filter(Boolean);
}

function completeness(candidate: ProspectCandidate): number {
  return [candidate.phone, candidate.website, candidate.instagram, candidate.address].filter(Boolean).length * 10
    + candidate.opportunityScore;
}

export function deduplicateProspects(candidates: ProspectCandidate[]): { candidates: ProspectCandidate[]; duplicates: number } {
  const result: ProspectCandidate[] = [];
  const keyToIndex = new Map<string, number>();
  let duplicates = 0;

  for (const candidate of candidates) {
    const keys = identityKeys(candidate);
    const existingIndex = keys.map((key) => keyToIndex.get(key)).find((index) => index !== undefined);
    if (existingIndex === undefined) {
      const index = result.push(candidate) - 1;
      keys.forEach((key) => keyToIndex.set(key, index));
      continue;
    }
    duplicates += 1;
    if (completeness(candidate) > completeness(result[existingIndex])) result[existingIndex] = candidate;
    keys.forEach((key) => keyToIndex.set(key, existingIndex));
  }

  return { candidates: result, duplicates };
}
