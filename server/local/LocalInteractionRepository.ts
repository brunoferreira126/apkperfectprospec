import { randomUUID } from "node:crypto";
import type { InteractionRecord, InteractionRepository } from "../repositories/InteractionRepository";
import { readCollection, writeCollection } from "./LocalStore";

let writeQueue = Promise.resolve();
export class LocalInteractionRepository implements InteractionRepository {
  async append(input: Omit<InteractionRecord, "id">): Promise<InteractionRecord> { const record = { ...input, id: randomUUID() }; writeQueue = writeQueue.then(async () => { const records = await readCollection<InteractionRecord>("interactions"); records.push(record); await writeCollection("interactions", records); }); await writeQueue; return record; }
  async listByLead(leadId: string): Promise<InteractionRecord[]> { return (await readCollection<InteractionRecord>("interactions")).filter((record) => record.leadId === leadId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)); }
}
