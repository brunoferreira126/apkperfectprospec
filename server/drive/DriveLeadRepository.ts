import { randomUUID } from "node:crypto";
import type { CreateLeadInput, Lead, LeadFilters, LeadRepository, UpdateLeadInput } from "../repositories/LeadRepository";
import { DriveClient } from "./DriveClient";
import { ensureDrivePath } from "./DriveStructure";

type StoredLead = Lead & { _driveFileId?: string };

export class DriveLeadRepository implements LeadRepository {
  constructor(private readonly client = new DriveClient()) {}

  private normalize(lead: Lead): Lead {
    return { ...lead, version: lead.version ?? 1 };
  }

  private async folderId(): Promise<string> {
    return ensureDrivePath(this.client, "database/leads");
  }

  async create(data: CreateLeadInput): Promise<Lead> {
    const now = new Date().toISOString();
    const lead: Lead = { ...data, id: randomUUID(), version: 1, createdAt: now, updatedAt: now };
    await this.client.upsertJson(await this.folderId(), `${lead.id}.json`, lead);
    return lead;
  }

  async findById(id: string): Promise<Lead | null> {
    const file = (await this.client.listJson(await this.folderId())).find((item) => item.name === `${id}.json`);
    return file ? this.normalize(await this.client.getJson<Lead>(file.id)) : null;
  }

  async list(filters: LeadFilters = {}): Promise<Lead[]> {
    const files = await this.client.listJson(await this.folderId());
    const leads = await Promise.all(files.map(async (file) => ({ ...this.normalize(await this.client.getJson<Lead>(file.id)), _driveFileId: file.id })));
    return leads.filter((lead) =>
      (!filters.status || lead.status === filters.status) &&
      (!filters.city || lead.city.toLocaleLowerCase("pt-BR") === filters.city.toLocaleLowerCase("pt-BR")) &&
      (!filters.segment || lead.segment.toLocaleLowerCase("pt-BR") === filters.segment.toLocaleLowerCase("pt-BR")) &&
      (!filters.query || `${lead.companyName} ${lead.city} ${lead.segment}`.toLocaleLowerCase("pt-BR").includes(filters.query.toLocaleLowerCase("pt-BR"))),
    ).map(({ _driveFileId: _ignored, ...lead }) => lead).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async update(id: string, data: UpdateLeadInput): Promise<Lead> {
    const file = (await this.client.listJson(await this.folderId())).find((item) => item.name === `${id}.json`);
    if (!file) throw new Error("LEAD_NOT_FOUND");
    const current = await this.client.getJson<Lead>(file.id);
    if ((current.version ?? 1) !== data.expectedVersion) throw new Error("LEAD_VERSION_CONFLICT");
    const { expectedVersion: _expectedVersion, ...changes } = data;
    const lead: Lead = { ...current, ...changes, id, version: (current.version ?? 1) + 1, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
    await this.client.upsertJson(await this.folderId(), `${id}.json`, lead, file.id);
    return lead;
  }

  async delete(id: string): Promise<void> {
    const file = (await this.client.listJson(await this.folderId())).find((item) => item.name === `${id}.json`);
    if (file) await this.client.delete(file.id);
  }
}
