import type { Offer } from "../config/offers";
import type { ScoreBreakdown } from "../config/scoring";
import type { Lead } from "../repositories/LeadRepository";

export interface LeadAIAnalysis extends ScoreBreakdown {
  summary: string;
  identifiedProblem: string;
  opportunity: string;
  recommendedOffer: string;
  reasoning: string;
  approachMessage: string;
}

export interface LLMProvider {
  analyzeLead(lead: Lead, offers: Offer[]): Promise<LeadAIAnalysis>;
}
