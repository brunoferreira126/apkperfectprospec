export type ProspectDecisionAction = "approved" | "rejected" | "contact_invalidated";
export type ProspectDecisionScope = "company" | "contact";

export interface ProspectDecisionEvent {
  id: string;
  action: ProspectDecisionAction;
  scope: ProspectDecisionScope;
  reason: string;
  fingerprint: string;
  actorId: string;
  occurredAt: string;
}

export interface ProspectDecisionRecord {
  externalId: string;
  latest: ProspectDecisionEvent;
  history: ProspectDecisionEvent[];
  updatedAt: string;
}

export interface RecordProspectDecisionInput {
  externalId: string;
  action: ProspectDecisionAction;
  scope: ProspectDecisionScope;
  reason: string;
  fingerprint: string;
  actorId: string;
}

export interface ProspectDecisionRepository {
  list(): Promise<ProspectDecisionRecord[]>;
  findManyByExternalIds(externalIds: string[]): Promise<ProspectDecisionRecord[]>;
  findByExternalId(externalId: string): Promise<ProspectDecisionRecord | null>;
  record(input: RecordProspectDecisionInput): Promise<ProspectDecisionRecord>;
}
