import { calculateScore, SCORE_LIMITS } from "../config/scoring.ts";
import type { Offer } from "../config/offers";
import type { LeadAIAnalysis } from "./LLMProvider";

function boundedInteger(record: Record<string, unknown>, key: keyof typeof SCORE_LIMITS): number {
  const value = record[key];
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > SCORE_LIMITS[key]) throw new Error(`AI_OUTPUT_INVALID:${key}`);
  return Number(value);
}

function safeText(record: Record<string, unknown>, key: string, max: number): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`AI_OUTPUT_INVALID:${key}`);
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) throw new Error(`AI_OUTPUT_INVALID:${key}`);
  return clean;
}

export function validateAIAnalysis(value: unknown, offers: Offer[]): LeadAIAnalysis {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("AI_OUTPUT_INVALID:payload");
  const record = value as Record<string, unknown>;
  const analysis: LeadAIAnalysis = {
    commercialFit: boundedInteger(record, "commercialFit"),
    digitalOpportunity: boundedInteger(record, "digitalOpportunity"),
    decisionMakerAccess: boundedInteger(record, "decisionMakerAccess"),
    activityReputation: boundedInteger(record, "activityReputation"),
    summary: safeText(record, "summary", 700),
    identifiedProblem: safeText(record, "identifiedProblem", 700),
    opportunity: safeText(record, "opportunity", 700),
    recommendedOffer: safeText(record, "recommendedOffer", 100),
    reasoning: safeText(record, "reasoning", 1000),
    approachMessage: safeText(record, "approachMessage", 1200),
  };
  calculateScore(analysis);
  if (!offers.some((offer) => offer.active && offer.name === analysis.recommendedOffer)) throw new Error("AI_OUTPUT_INVALID:recommendedOffer");
  return analysis;
}
