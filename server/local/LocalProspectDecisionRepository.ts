import { randomUUID } from "node:crypto";
import type { ProspectDecisionRecord, ProspectDecisionRepository, RecordProspectDecisionInput } from "../repositories/ProspectDecisionRepository";
import { readCollection, writeCollection } from "./LocalStore";

let writeQueue = Promise.resolve();

export class LocalProspectDecisionRepository implements ProspectDecisionRepository {
  async list(): Promise<ProspectDecisionRecord[]> { return readCollection("prospect-decisions"); }
  async findManyByExternalIds(externalIds: string[]): Promise<ProspectDecisionRecord[]> { const ids = new Set(externalIds); return (await this.list()).filter((item) => ids.has(item.externalId)); }
  async findByExternalId(externalId: string): Promise<ProspectDecisionRecord | null> { return (await this.list()).find((item) => item.externalId === externalId) ?? null; }
  async record(input: RecordProspectDecisionInput): Promise<ProspectDecisionRecord> {
    let saved: ProspectDecisionRecord | undefined;
    writeQueue = writeQueue.then(async () => {
      const records = await this.list();
      const index = records.findIndex((item) => item.externalId === input.externalId);
      const event = { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
      const record: ProspectDecisionRecord = {
        externalId: input.externalId, latest: event,
        history: [...(index >= 0 ? records[index].history : []), event].slice(-50), updatedAt: event.occurredAt,
      };
      if (index >= 0) records[index] = record; else records.push(record);
      await writeCollection("prospect-decisions", records);
      saved = record;
    });
    await writeQueue;
    return saved!;
  }
}
