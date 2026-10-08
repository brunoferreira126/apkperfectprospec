export type LeadStatus =
  | "new"
  | "qualified"
  | "contact_ready"
  | "contacted"
  | "responded"
  | "interested"
  | "proposal"
  | "won"
  | "lost"
  | "discarded";

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
  decisionMaker?: {
    name?: string;
    role?: string;
    contact?: string;
  };
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

export type CreateLeadInput = Omit<Lead, "id" | "version" | "createdAt" | "updatedAt">;
export type UpdateLeadInput = Partial<Omit<Lead, "id" | "createdAt" | "version">> & { expectedVersion: number };
export interface LeadFilters { status?: LeadStatus; city?: string; segment?: string; query?: string }

export interface LeadRepository {
  create(data: CreateLeadInput): Promise<Lead>;
  findById(id: string): Promise<Lead | null>;
  list(filters?: LeadFilters): Promise<Lead[]>;
  update(id: string, data: UpdateLeadInput): Promise<Lead>;
  delete(id: string): Promise<void>;
}
