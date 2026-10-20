import { DriveInteractionRepository } from "../drive/DriveInteractionRepository";
import { DriveLeadRepository } from "../drive/DriveLeadRepository";
import { DriveProspectDecisionRepository } from "../drive/DriveProspectDecisionRepository";
import { LocalInteractionRepository } from "../local/LocalInteractionRepository";
import { LocalLeadRepository } from "../local/LocalLeadRepository";
import { LocalProspectDecisionRepository } from "../local/LocalProspectDecisionRepository";
import type { InteractionRepository } from "./InteractionRepository";
import type { LeadRepository } from "./LeadRepository";
import type { ProspectDecisionRepository } from "./ProspectDecisionRepository";

export function createLeadRepository(): LeadRepository { return process.env.STORAGE_PROVIDER === "local" ? new LocalLeadRepository() : new DriveLeadRepository(); }
export function createInteractionRepository(): InteractionRepository { return process.env.STORAGE_PROVIDER === "local" ? new LocalInteractionRepository() : new DriveInteractionRepository(); }
export function createProspectDecisionRepository(): ProspectDecisionRepository { return process.env.STORAGE_PROVIDER === "local" ? new LocalProspectDecisionRepository() : new DriveProspectDecisionRepository(); }
