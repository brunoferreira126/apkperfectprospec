export interface SearchRequest {
  cities: string[];
  segments: string[];
}

export type VerificationClassification = "qualified" | "pending" | "discarded";
export type VerificationConfidence = "high" | "medium" | "low";

export interface ProspectEvidence {
  field: "identity" | "address" | "phone" | "website" | "instagram" | "activity" | "procurement";
  source: string;
  url?: string;
  observedAt: string;
  statement: string;
  confidence: VerificationConfidence;
}

export interface ProspectVerification {
  classification: VerificationClassification;
  confidence: VerificationConfidence;
  checkedAt: string;
  fingerprint: string;
  identity: { status: "probable" | "unverified"; reason: string };
  address: { status: "consistent" | "inconsistent" | "missing"; reason: string };
  activity: { status: "active_signal" | "inactive_signal" | "unknown"; reason: string };
  phone: { status: "public_unverified" | "confirmed_whatsapp" | "conflict" | "invalid" | "missing"; reason: string };
  instagram: { status: "probable" | "confirmed" | "unverified" | "missing"; reason: string };
  website: { status: "probable" | "confirmed" | "unverified" | "missing"; reason: string };
  publicEntity: boolean;
  procurementRestriction?: string;
  uncertainties: string[];
  evidence: ProspectEvidence[];
  revaluationReason?: string;
}

export interface CommercialAssessment {
  investmentPotential: number;
  activityReputation: number;
  digitalOpportunity: number;
  contactReliability: number;
  decisionMakerAccess: number;
  procurementRestriction: "none" | "public_procurement" | "verify";
  explanation: string[];
  uncertainties: string[];
}

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
  verification: ProspectVerification;
  commercialAssessment: CommercialAssessment;
  qualification: {
    identifiedProblem: string;
    opportunity: string;
    recommendedOffer: string;
    tone: string;
    contactRoute: string;
    approachMessage: string;
  };
  source: "Overture Maps" | "OpenStreetMap" | "Google Places";
}
