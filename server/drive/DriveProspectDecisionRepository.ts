import { createHash, randomUUID } from "node:crypto";
import type { ProspectDecisionRecord, ProspectDecisionRepository, RecordProspectDecisionInput } from "../repositories/ProspectDecisionRepository";
import { DriveClient } from "./DriveClient";
import { ensureDrivePath } from "./DriveStructure";

export class DriveProspectDecisionRepository implements ProspectDecisionRepository {
  constructor(private readonly client = new DriveClient()) {}

  private async folderId(): Promise<string> {
    return ensureDrivePath(this.client, "database/prospect-decisions");
  }

  private fileName(externalId: string): string {
    return `${createHash("sha256").update(externalId).digest("hex")}.json`;
  }

  async list(): Promise<ProspectDecisionRecord[]> {
    const files = await this.client.listJson(await this.folderId());
    return Promise.all(files.map((file) => this.client.getJson<ProspectDecisionRecord>(file.id)));
  }

  async findManyByExternalIds(externalIds: string[]): Promise<ProspectDecisionRecord[]> {
    const files = await this.client.listJson(await this.folderId());
    const byName = new Map(files.map((file) => [file.name, file]));
    const matches = [...new Set(externalIds)].map((externalId) => byName.get(this.fileName(externalId))).filter((file): file is NonNullable<typeof file> => Boolean(file));
    return Promise.all(matches.map((file) => this.client.getJson<ProspectDecisionRecord>(file.id)));
  }

  async findByExternalId(externalId: string): Promise<ProspectDecisionRecord | null> {
    const file = (await this.client.listJson(await this.folderId())).find((item) => item.name === this.fileName(externalId));
    return file ? this.client.getJson<ProspectDecisionRecord>(file.id) : null;
  }

  async record(input: RecordProspectDecisionInput): Promise<ProspectDecisionRecord> {
    const folderId = await this.folderId();
    const fileName = this.fileName(input.externalId);
    const file = (await this.client.listJson(folderId)).find((item) => item.name === fileName);
    const current = file ? await this.client.getJson<ProspectDecisionRecord>(file.id) : null;
    const event = { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
    const record: ProspectDecisionRecord = {
      externalId: input.externalId,
      latest: event,
      history: [...(current?.history ?? []), event].slice(-50),
      updatedAt: event.occurredAt,
    };
    await this.client.upsertJson(folderId, fileName, record, file?.id);
    return record;
  }
}
