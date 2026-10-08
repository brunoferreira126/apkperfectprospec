import { randomUUID } from "node:crypto";
import type { CreateLeadInput, Lead, LeadFilters, LeadRepository, UpdateLeadInput } from "../repositories/LeadRepository";
import { readCollection, writeCollection } from "./LocalStore";

let writeQueue = Promise.resolve();
export class LocalLeadRepository implements LeadRepository {
  async create(data: CreateLeadInput): Promise<Lead> { const now = new Date().toISOString(); const lead: Lead = { ...data, id: randomUUID(), version: 1, createdAt: now, updatedAt: now }; writeQueue = writeQueue.then(async () => { const leads = await readCollection<Lead>("leads"); leads.push(lead); await writeCollection("leads", leads); }); await writeQueue; return lead; }
  async findById(id: string): Promise<Lead | null> { return (await readCollection<Lead>("leads")).find((lead) => lead.id === id) ?? null; }
  async list(filters: LeadFilters = {}): Promise<Lead[]> { return (await readCollection<Lead>("leads")).filter((lead) => (!filters.status || lead.status === filters.status) && (!filters.city || lead.city.toLocaleLowerCase("pt-BR") === filters.city.toLocaleLowerCase("pt-BR")) && (!filters.segment || lead.segment.toLocaleLowerCase("pt-BR") === filters.segment.toLocaleLowerCase("pt-BR")) && (!filters.query || `${lead.companyName} ${lead.city} ${lead.segment}`.toLocaleLowerCase("pt-BR").includes(filters.query.toLocaleLowerCase("pt-BR")))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async update(id: string, data: UpdateLeadInput): Promise<Lead> { let updated: Lead | undefined; writeQueue = writeQueue.then(async () => { const leads = await readCollection<Lead>("leads"); const index = leads.findIndex((lead) => lead.id === id); if (index < 0) throw new Error("LEAD_NOT_FOUND"); const current = leads[index]; if (current.version !== data.expectedVersion) throw new Error("LEAD_VERSION_CONFLICT"); const { expectedVersion: _ignored, ...changes } = data; updated = { ...current, ...changes, id, version: current.version + 1, createdAt: current.createdAt, updatedAt: new Date().toISOString() }; leads[index] = updated; await writeCollection("leads", leads); }); await writeQueue; return updated!; }
  async delete(id: string): Promise<void> { writeQueue = writeQueue.then(async () => { const leads = await readCollection<Lead>("leads"); await writeCollection("leads", leads.filter((lead) => lead.id !== id)); }); await writeQueue; }
}
