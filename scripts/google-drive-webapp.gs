const PERFECT_PROSPECT_SECRET = "SUBSTITUA_POR_UM_SEGREDO_FORTE";

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error("INVALID_" + field.toUpperCase());
  return value.trim();
}

function findFolder(parentId, name) {
  const folders = DriveApp.getFolderById(parentId).getFoldersByName(name);
  if (!folders.hasNext()) return null;
  const folder = folders.next();
  return { id: folder.getId(), name: folder.getName(), mimeType: "application/vnd.google-apps.folder" };
}

function handle(action, input) {
  if (action === "getJson") return JSON.parse(DriveApp.getFileById(requireText(input.fileId, "fileId")).getBlob().getDataAsString("UTF-8"));
  if (action === "listJson") {
    const files = DriveApp.getFolderById(requireText(input.parentId, "parentId")).getFiles();
    const result = [];
    while (files.hasNext()) {
      const file = files.next();
      if (file.getName().endsWith(".json") && !file.isTrashed()) result.push({ id: file.getId(), name: file.getName(), mimeType: "application/json" });
    }
    return result;
  }
  if (action === "findFolder") return findFolder(requireText(input.parentId, "parentId"), requireText(input.name, "name"));
  if (action === "createFolder") return DriveApp.getFolderById(requireText(input.parentId, "parentId")).createFolder(requireText(input.name, "name")).getId();
  if (action === "upsertJson") {
    const content = JSON.stringify(input.value);
    if (input.fileId) {
      const file = DriveApp.getFileById(requireText(input.fileId, "fileId"));
      file.setName(requireText(input.name, "name"));
      file.setContent(content);
      return file.getId();
    }
    return DriveApp.getFolderById(requireText(input.parentId, "parentId")).createFile(requireText(input.name, "name"), content, MimeType.PLAIN_TEXT).getId();
  }
  if (action === "delete") {
    DriveApp.getFileById(requireText(input.fileId, "fileId")).setTrashed(true);
    return true;
  }
  throw new Error("UNKNOWN_ACTION");
}

function doPost(event) {
  try {
    const input = JSON.parse(event.postData.contents || "{}");
    if (input.secret !== PERFECT_PROSPECT_SECRET) return jsonOutput({ ok: false, error: "UNAUTHORIZED" });
    return jsonOutput({ ok: true, result: handle(input.action, input) });
  } catch (error) {
    console.error(error);
    return jsonOutput({ ok: false, error: String(error && error.message ? error.message : "FAILED") });
  }
}
