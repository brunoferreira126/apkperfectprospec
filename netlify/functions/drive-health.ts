import type { Handler } from "@netlify/functions";
import { authorize } from "../../server/auth/authorize";
import { DriveClient } from "../../server/drive/DriveClient";
import { ensureDriveStructure } from "../../server/drive/DriveStructure";
import { json, safeError } from "./_shared/http";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return safeError(405, "METHOD_NOT_ALLOWED");
  const session = authorize(event, ["ADMIN"]);
  if (!session) return safeError(403, "FORBIDDEN");
  try {
    const folders = await ensureDriveStructure(new DriveClient());
    return json(200, { ok: true, folders: Object.keys(folders) });
  } catch {
    return safeError(502, "DRIVE_UNAVAILABLE");
  }
};
