import { DriveInteractionRepository } from "../drive/DriveInteractionRepository";
import { DriveLeadRepository } from "../drive/DriveLeadRepository";
import { LocalInteractionRepository } from "../local/LocalInteractionRepository";
import { LocalLeadRepository } from "../local/LocalLeadRepository";
import type { InteractionRepository } from "./InteractionRepository";
import type { LeadRepository } from "./LeadRepository";

export function createLeadRepository(): LeadRepository { return process.env.STORAGE_PROVIDER === "local" ? new LocalLeadRepository() : new DriveLeadRepository(); }
export function createInteractionRepository(): InteractionRepository { return process.env.STORAGE_PROVIDER === "local" ? new LocalInteractionRepository() : new DriveInteractionRepository(); }
