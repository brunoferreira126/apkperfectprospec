import { DriveClient } from "./DriveClient";

const REQUIRED_PATHS = ["database/leads", "database/interactions", "database/opportunities", "database/searches", "database/prospect-decisions", "reports", "exports", "backups", "logs"];

const cached = new Map<string, { id: string; expiresAt: number }>();
const pending = new Map<string, Promise<string>>();

export async function ensureDrivePath(client: DriveClient, path: string): Promise<string> {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) throw new Error("DRIVE_CONFIGURATION_MISSING:GOOGLE_DRIVE_FOLDER_ID");
  let parentId = rootId;
  let current = "";
  for (const part of path.split("/").filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    const key = `${rootId}:${current}`;
    const hit = cached.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      parentId = hit.id;
      continue;
    }
    let lookup = pending.get(key);
    if (!lookup) {
      const lookupParent = parentId;
      lookup = (async () => (await client.findFolder(lookupParent, part))?.id ?? client.createFolder(lookupParent, part))()
        .then((id) => { cached.set(key, { id, expiresAt: Date.now() + 5 * 60_000 }); return id; })
        .finally(() => { pending.delete(key); });
      pending.set(key, lookup);
    }
    parentId = await lookup;
  }
  return parentId;
}

export async function ensureDriveStructure(client: DriveClient): Promise<Record<string, string>> {
  const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!rootId) throw new Error("DRIVE_CONFIGURATION_MISSING:GOOGLE_DRIVE_FOLDER_ID");
  const ids: Record<string, string> = { root: rootId };
  await Promise.all(REQUIRED_PATHS.map(async (path) => { ids[path] = await ensureDrivePath(client, path); }));
  return ids;
}
