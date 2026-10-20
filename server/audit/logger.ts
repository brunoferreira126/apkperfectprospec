export type AuditEvent =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "LEAD_CREATED"
  | "LEAD_UPDATED"
  | "LEAD_DELETED"
  | "AI_ANALYSIS_REQUESTED"
  | "AI_ANALYSIS_COMPLETED"
  | "CONTACT_APPROVED"
  | "STATUS_CHANGED"
  | "OPPORTUNITY_WON"
  | "OPPORTUNITY_LOST"
  | "PROSPECT_SEARCHED"
  | "SEARCH_RESULTS_IMPORTED"
  | "PROSPECT_DECISION_RECORDED";

export function audit(event: AuditEvent, userId: string, entityId?: string, metadata: Record<string, unknown> = {}): void {
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !/(token|secret|password|credential|authorization)/i.test(key)),
  );
  console.info(JSON.stringify({ type: "audit", event, userId, entityId, timestamp: new Date().toISOString(), metadata: safeMetadata }));
}
