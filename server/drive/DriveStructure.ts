import { DriveClient } from "./DriveClient";

const REQUIRED_PATHS = ["database/leads", "database/interactions", "database/opportunities", "database/searches", "reports", "exports", "backups", "logs"];

export async function ensureDriveStructure(client: DriveClient): Promise<Record<string, string>> {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) throw new Error("DRIVE_CONFIGURATION_MISSING:GOOGLE_DRIVE_FOLDER_ID");
  const ids: Record<string, string> = { root: rootId };
  for (const path of REQUIRED_PATHS) {
    let parentId = rootId;
    let current = "";
    for (const part of path.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!ids[current]) {
        ids[current] = (await client.findFolder(parentId, part))?.id ?? await client.createFolder(parentId, part);
      }
      parentId = ids[current];
    }
  }
  return ids;
}
