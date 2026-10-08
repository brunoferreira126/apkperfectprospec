export interface InteractionRecord {
  id: string;
  leadId: string;
  type: "LEAD_CREATED" | "LEAD_UPDATED" | "STATUS_CHANGED" | "AI_ANALYSIS_COMPLETED";
  occurredAt: string;
  actorId: string;
  metadata: Record<string, unknown>;
}

export interface InteractionRepository {
  append(record: Omit<InteractionRecord, "id">): Promise<InteractionRecord>;
  listByLead(leadId: string): Promise<InteractionRecord[]>;
}
