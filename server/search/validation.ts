import { SEARCH_CITIES, SEARCH_SEGMENTS } from "./catalog.ts";
import type { SearchRequest } from "./types.ts";

export function validateSearchRequest(value: unknown): SearchRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("SEARCH_VALIDATION:payload");
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.cities) || !Array.isArray(input.segments)) throw new Error("SEARCH_VALIDATION:filters");
  const cities = [...new Set(input.cities.filter((item): item is string => typeof item === "string"))];
  const segments = [...new Set(input.segments.filter((item): item is string => typeof item === "string"))];
  if (!cities.length || !segments.length) throw new Error("SEARCH_VALIDATION:empty");
  if (cities.some((city) => !SEARCH_CITIES.includes(city as typeof SEARCH_CITIES[number]))) throw new Error("SEARCH_VALIDATION:city");
  if (segments.some((segment) => !SEARCH_SEGMENTS.includes(segment as typeof SEARCH_SEGMENTS[number]))) throw new Error("SEARCH_VALIDATION:segment");
  return { cities, segments };
}
