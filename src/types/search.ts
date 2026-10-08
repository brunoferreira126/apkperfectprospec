export interface ProspectCandidate {
  externalId: string;
  companyName: string;
  segment: string;
  city: string;
  address?: string;
  phone?: string;
  website?: string;
  instagram?: string;
  mapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  opportunityScore: number;
  signals: string[];
  qualification: {
    identifiedProblem: string;
    opportunity: string;
    recommendedOffer: string;
    tone: string;
    contactRoute: string;
    approachMessage: string;
  };
  source: "OpenStreetMap" | "Google Places";
}
