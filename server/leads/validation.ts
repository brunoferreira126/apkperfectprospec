import type { CreateLeadInput, LeadStatus, UpdateLeadInput } from "../repositories/LeadRepository";

const STATUSES: LeadStatus[] = ["new", "qualified", "contact_ready", "contacted", "responded", "interested", "proposal", "won", "lost", "discarded"];

function text(value: unknown, field: string, max: number, required = false): string | undefined {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`VALIDATION:${field}`);
    return undefined;
  }
  if (typeof value !== "string") throw new Error(`VALIDATION:${field}`);
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if ((required && !clean) || clean.length > max) throw new Error(`VALIDATION:${field}`);
  return clean || undefined;
}

function webUrl(value: unknown, field: string): string | undefined {
  const clean = text(value, field, 300);
  if (!clean) return undefined;
  const normalized = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  try {
    const url = new URL(normalized);
    if (!url.hostname || !["http:", "https:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch { throw new Error(`VALIDATION:${field}`); }
}

function phone(value: unknown): string | undefined {
  const clean = text(value, "whatsapp", 30);
  if (!clean) return undefined;
  if (!/^\+?[\d\s().-]{8,30}$/.test(clean)) throw new Error("VALIDATION:whatsapp");
  return clean;
}

function status(value: unknown, fallback?: LeadStatus): LeadStatus {
  if (typeof value !== "string" || !STATUSES.includes(value as LeadStatus)) {
    if (fallback) return fallback;
    throw new Error("VALIDATION:status");
  }
  return value as LeadStatus;
}

function decisionMaker(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("VALIDATION:decisionMaker");
  const record = value as Record<string, unknown>;
  const result = { name: text(record.name, "decisionMaker.name", 100), role: text(record.role, "decisionMaker.role", 100), contact: text(record.contact, "decisionMaker.contact", 160) };
  return Object.values(result).some(Boolean) ? result : undefined;
}

export function validateCreateLead(value: unknown): CreateLeadInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("VALIDATION:payload");
  const input = value as Record<string, unknown>;
  return {
    companyName: text(input.companyName, "companyName", 160, true)!,
    segment: text(input.segment, "segment", 100, true)!,
    city: text(input.city, "city", 100, true)!,
    source: text(input.source, "source", 100, true)!,
    externalId: text(input.externalId, "externalId", 180),
    sourceUrl: webUrl(input.sourceUrl, "sourceUrl"),
    status: status(input.status ?? "new"),
    instagram: text(input.instagram, "instagram", 160),
    whatsapp: phone(input.whatsapp),
    website: webUrl(input.website, "website"),
    decisionMaker: decisionMaker(input.decisionMaker),
    notes: text(input.notes, "notes", 2000),
  };
}

export function validateUpdateLead(value: unknown): UpdateLeadInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("VALIDATION:payload");
  const input = value as Record<string, unknown>;
  if (!Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) throw new Error("VALIDATION:expectedVersion");
  const result: UpdateLeadInput = { expectedVersion: Number(input.expectedVersion) };
  if ("companyName" in input) result.companyName = text(input.companyName, "companyName", 160, true)!;
  if ("segment" in input) result.segment = text(input.segment, "segment", 100, true)!;
  if ("city" in input) result.city = text(input.city, "city", 100, true)!;
  if ("source" in input) result.source = text(input.source, "source", 100, true)!;
  if ("externalId" in input) result.externalId = text(input.externalId, "externalId", 180);
  if ("sourceUrl" in input) result.sourceUrl = webUrl(input.sourceUrl, "sourceUrl");
  if ("status" in input) result.status = status(input.status);
  if ("instagram" in input) result.instagram = text(input.instagram, "instagram", 160);
  if ("whatsapp" in input) result.whatsapp = phone(input.whatsapp);
  if ("website" in input) result.website = webUrl(input.website, "website");
  if ("decisionMaker" in input) result.decisionMaker = decisionMaker(input.decisionMaker);
  if ("notes" in input) result.notes = text(input.notes, "notes", 2000);
  return result;
}

export function isLeadStatus(value: string | undefined): value is LeadStatus {
  return Boolean(value && STATUSES.includes(value as LeadStatus));
}
