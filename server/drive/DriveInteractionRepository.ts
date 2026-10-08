import { randomUUID } from "node:crypto";
import type { InteractionRecord, InteractionRepository } from "../repositories/InteractionRepository";
import { DriveClient } from "./DriveClient";
import { ensureDriveStructure } from "./DriveStructure";

export class DriveInteractionRepository implements InteractionRepository {
  constructor(private readonly client = new DriveClient()) {}

  private async folderId(): Promise<string> {
    return (await ensureDriveStructure(this.client))["database/interactions"];
  }

  async append(input: Omit<InteractionRecord, "id">): Promise<InteractionRecord> {
    const record: InteractionRecord = { ...input, id: randomUUID() };
    const safeLeadId = record.leadId.replace(/[^a-zA-Z0-9-]/g, "");
    await this.client.upsertJson(await this.folderId(), `${safeLeadId}__${record.occurredAt.replace(/[:.]/g, "-")}__${record.id}.json`, record);
    return record;
  }

  async listByLead(leadId: string): Promise<InteractionRecord[]> {
    const files = await this.client.listJson(await this.folderId());
    const matching = files.filter((file) => file.name.startsWith(`${leadId}__`));
    const records = await Promise.all(matching.map((file) => this.client.getJson<InteractionRecord>(file.id)));
    return records.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
}
