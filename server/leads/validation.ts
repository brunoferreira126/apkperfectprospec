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

function contactEvidence(value: unknown) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("VALIDATION:contactEvidence");
  const record = value as Record<string, unknown>;
  const phoneStatuses = new Set(["missing", "public_unverified", "confirmed_whatsapp", "conflict", "invalid"]);
  const associationStatuses = new Set(["missing", "probable", "confirmed", "unverified"]);
  const publicPhone = text(record.publicPhone, "contactEvidence.publicPhone", 30);
  if (publicPhone && !/^\+?[\d\s().-]{8,30}$/.test(publicPhone)) throw new Error("VALIDATION:contactEvidence.publicPhone");
  const phoneStatus = text(record.phoneStatus, "contactEvidence.phoneStatus", 30);
  const instagramStatus = text(record.instagramStatus, "contactEvidence.instagramStatus", 30);
  const websiteStatus = text(record.websiteStatus, "contactEvidence.websiteStatus", 30);
  if (phoneStatus && !phoneStatuses.has(phoneStatus)) throw new Error("VALIDATION:contactEvidence.phoneStatus");
  if (instagramStatus && !associationStatuses.has(instagramStatus)) throw new Error("VALIDATION:contactEvidence.instagramStatus");
  if (websiteStatus && !associationStatuses.has(websiteStatus)) throw new Error("VALIDATION:contactEvidence.websiteStatus");
  const result = {
    publicPhone,
    phoneStatus: phoneStatus as "missing" | "public_unverified" | "confirmed_whatsapp" | "conflict" | "invalid" | undefined,
    phoneReason: text(record.phoneReason, "contactEvidence.phoneReason", 300),
    publicInstagram: text(record.publicInstagram, "contactEvidence.publicInstagram", 300),
    instagramStatus: instagramStatus as "missing" | "probable" | "confirmed" | "unverified" | undefined,
    instagramReason: text(record.instagramReason, "contactEvidence.instagramReason", 300),
    publicWebsite: webUrl(record.publicWebsite, "contactEvidence.publicWebsite"),
    websiteStatus: websiteStatus as "missing" | "probable" | "confirmed" | "unverified" | undefined,
    websiteReason: text(record.websiteReason, "contactEvidence.websiteReason", 300),
  };
  return Object.values(result).some(Boolean) ? result : undefined;
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
    contactEvidence: contactEvidence(input.contactEvidence),
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
  if ("contactEvidence" in input) result.contactEvidence = contactEvidence(input.contactEvidence);
  if ("generatedMessage" in input) result.generatedMessage = text(input.generatedMessage, "generatedMessage", 2000);
  if ("decisionMaker" in input) result.decisionMaker = decisionMaker(input.decisionMaker);
  if ("notes" in input) result.notes = text(input.notes, "notes", 2000);
  return result;
}

export function isLeadStatus(value: string | undefined): value is LeadStatus {
  return Boolean(value && STATUSES.includes(value as LeadStatus));
}
