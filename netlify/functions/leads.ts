import type { Handler, HandlerEvent } from "@netlify/functions";
import { audit } from "../../server/audit/logger";
import { authorize, isSameOrigin } from "../../server/auth/authorize";
import { createInteractionRepository, createLeadRepository } from "../../server/repositories/factory";
import { isLeadStatus, validateCreateLead, validateUpdateLead } from "../../server/leads/validation";
import { json, parseJson, safeError } from "./_shared/http";
import { allowAttempt } from "./_shared/rateLimit";

const ids = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function leadId(event: HandlerEvent): string | undefined {
  const id = event.queryStringParameters?.id;
  return id && ids.test(id) ? id : undefined;
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("VALIDATION:")) return safeError(400, "INVALID_LEAD_DATA");
  if (message === "LEAD_NOT_FOUND") return safeError(404, "LEAD_NOT_FOUND");
  if (message === "LEAD_VERSION_CONFLICT") return safeError(409, "LEAD_VERSION_CONFLICT");
  if (message.startsWith("DRIVE_CONFIGURATION_MISSING")) return safeError(503, "STORAGE_NOT_CONFIGURED");
  return safeError(502, "STORAGE_UNAVAILABLE");
}

export const handler: Handler = async (event) => {
  const readSession = authorize(event);
  if (!readSession) return safeError(401, "UNAUTHORIZED");

  const leads = createLeadRepository();
  const interactions = createInteractionRepository();

  try {
    if (event.httpMethod === "GET") {
      const id = leadId(event);
      if (event.queryStringParameters?.id && !id) return safeError(400, "INVALID_LEAD_ID");
      if (id) {
        const lead = await leads.findById(id);
        if (!lead) return safeError(404, "LEAD_NOT_FOUND");
        return json(200, { lead, history: await interactions.listByLead(id) });
      }
      const status = event.queryStringParameters?.status;
      if (status && !isLeadStatus(status)) return safeError(400, "INVALID_FILTER");
      const statusFilter = isLeadStatus(status) ? status : undefined;
      const query = event.queryStringParameters?.query?.trim().slice(0, 120);
      const city = event.queryStringParameters?.city?.trim().slice(0, 100);
      const segment = event.queryStringParameters?.segment?.trim().slice(0, 100);
      return json(200, { leads: await leads.list({ status: statusFilter, query, city, segment }) });
    }

    if (!isSameOrigin(event)) return safeError(403, "INVALID_ORIGIN");
    const mutationSession = authorize(event, ["ADMIN", "COMMERCIAL"]);
    if (!mutationSession) return safeError(403, "FORBIDDEN");
    if (!allowAttempt(`lead:${mutationSession.sub}`, 120, 15 * 60_000)) return safeError(429, "TOO_MANY_REQUESTS");

    if (event.httpMethod === "POST") {
      const input = validateCreateLead(parseJson<unknown>(event.body, 12_000));
      const lead = await leads.create(input);
      try {
        await interactions.append({ leadId: lead.id, type: "LEAD_CREATED", occurredAt: lead.createdAt, actorId: mutationSession.sub, metadata: { source: lead.source } });
      } catch (error) {
        await leads.delete(lead.id).catch(() => undefined);
        throw error;
      }
      audit("LEAD_CREATED", mutationSession.sub, lead.id, { source: lead.source });
      return json(201, { lead });
    }

    const id = leadId(event);
    if (!id) return safeError(400, "INVALID_LEAD_ID");

    if (event.httpMethod === "PATCH") {
      const current = await leads.findById(id);
      if (!current) return safeError(404, "LEAD_NOT_FOUND");
      const input = validateUpdateLead(parseJson<unknown>(event.body, 12_000));
      const lead = await leads.update(id, input);
      const statusChanged = input.status !== undefined && input.status !== current.status;
      await interactions.append({
        leadId: id,
        type: statusChanged ? "STATUS_CHANGED" : "LEAD_UPDATED",
        occurredAt: lead.updatedAt,
        actorId: mutationSession.sub,
        metadata: statusChanged ? { from: current.status, to: lead.status } : { fields: Object.keys(input).filter((key) => key !== "expectedVersion") },
      });
      audit(statusChanged ? "STATUS_CHANGED" : "LEAD_UPDATED", mutationSession.sub, id, statusChanged ? { from: current.status, to: lead.status } : {});
      return json(200, { lead });
    }

    if (event.httpMethod === "DELETE") {
      const admin = authorize(event, ["ADMIN"]);
      if (!admin) return safeError(403, "FORBIDDEN");
      const current = await leads.findById(id);
      if (!current) return safeError(404, "LEAD_NOT_FOUND");
      await leads.delete(id);
      audit("LEAD_DELETED", admin.sub, id, { companyName: current.companyName });
      return { statusCode: 204, headers: { "cache-control": "no-store" }, body: "" };
    }

    return safeError(405, "METHOD_NOT_ALLOWED");
  } catch (error) {
    console.error(JSON.stringify({ type: "operational_error", scope: "leads", code: error instanceof Error ? error.message.split(":")[0] : "UNKNOWN" }));
    return mapError(error);
  }
};
