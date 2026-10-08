export type LeadStatus = "new" | "qualified" | "contact_ready" | "contacted" | "responded" | "interested" | "proposal" | "won" | "lost" | "discarded";

export interface Lead {
  id: string;
  version: number;
  companyName: string;
  segment: string;
  city: string;
  source: string;
  externalId?: string;
  sourceUrl?: string;
  status: LeadStatus;
  instagram?: string;
  whatsapp?: string;
  website?: string;
  decisionMaker?: { name?: string; role?: string; contact?: string };
  notes?: string;
  score?: number;
  scoreBreakdown?: {
    commercialFit: number;
    digitalOpportunity: number;
    decisionMakerAccess: number;
    activityReputation: number;
  };
  analysis?: {
    summary: string;
    identifiedProblem: string;
    opportunity: string;
    recommendedOffer: string;
    reasoning: string;
    analyzedAt: string;
  };
  generatedMessage?: string;
  messageGeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadInput {
  companyName: string;
  segment: string;
  city: string;
  source: string;
  externalId?: string;
  sourceUrl?: string;
  status: LeadStatus;
  instagram?: string;
  whatsapp?: string;
  website?: string;
  decisionMaker?: { name?: string; role?: string; contact?: string };
  notes?: string;
}

export interface Interaction {
  id: string;
  leadId: string;
  type: "LEAD_CREATED" | "LEAD_UPDATED" | "STATUS_CHANGED" | "AI_ANALYSIS_COMPLETED";
  occurredAt: string;
  actorId: string;
  metadata: Record<string, unknown>;
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Novo",
  qualified: "Qualificado",
  contact_ready: "Pronto para contato",
  contacted: "Contatado",
  responded: "Respondeu",
  interested: "Interessado",
  proposal: "Proposta",
  won: "Fechado",
  lost: "Perdido",
  discarded: "Descartado",
};
