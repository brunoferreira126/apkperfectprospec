import type { SearchProviderResult, SearchRequest } from "./types.ts";

export interface SearchProvider {
  readonly id: string;
  search(input: SearchRequest): SearchProviderResult | Promise<SearchProviderResult>;
}
