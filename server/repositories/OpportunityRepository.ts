export interface OpportunityRecord {
  id: string;
  leadId: string;
  status: "open" | "won" | "lost";
  value?: number;
  monthlyValue?: number;
  updatedAt: string;
}

export interface OpportunityRepository {
  findByLead(leadId: string): Promise<OpportunityRecord | null>;
  save(record: OpportunityRecord): Promise<OpportunityRecord>;
}
