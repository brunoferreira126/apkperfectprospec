export const SCORE_LIMITS = {
  commercialFit: 30,
  digitalOpportunity: 30,
  decisionMakerAccess: 25,
  activityReputation: 15,
} as const;

export type ScoreBreakdown = Record<keyof typeof SCORE_LIMITS, number>;

export function calculateScore(input: ScoreBreakdown): number {
  return Object.entries(SCORE_LIMITS).reduce((total, [key, limit]) => {
    const value = input[key as keyof ScoreBreakdown];
    if (!Number.isInteger(value) || value < 0 || value > limit) throw new Error(`AI_OUTPUT_INVALID:${key}`);
    return total + value;
  }, 0);
}

export function scorePriority(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}
