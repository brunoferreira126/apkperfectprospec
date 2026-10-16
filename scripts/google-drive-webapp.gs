const SECRET_PROPERTY = "PERFECT_PROSPECT_SECRET";
const ROOT_FOLDER_PROPERTY = "PERFECT_PROSPECT_ROOT_FOLDER_ID";
const JSON_MIME_TYPE = "application/json";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const SHORTCUT_MIME_TYPE = "application/vnd.google-apps.shortcut";
const MAX_REQUEST_LENGTH = 200000;
const MAX_PARENT_NODES = 200;

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function fail(code) {
  const error = new Error(code);
  error.safeCode = code;
  throw error;
}

function requireId(value, field) {
  if (typeof value !== "string") fail("INVALID_" + field.toUpperCase());
  const clean = value.trim();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(clean)) fail("INVALID_" + field.toUpperCase());
  return clean;
}

function requireName(value, field, requireJsonExtension) {
  if (typeof value !== "string") fail("INVALID_" + field.toUpperCase());
  const clean = value.trim();
  if (!clean || clean.length > 180 || /[\\/\u0000-\u001F\u007F]/.test(clean)) fail("INVALID_" + field.toUpperCase());
  if (requireJsonExtension && !clean.endsWith(".json")) fail("INVALID_" + field.toUpperCase());
  return clean;
}

function configuration() {
  const properties = PropertiesService.getScriptProperties();
  const secret = properties.getProperty(SECRET_PROPERTY);
  const rootFolderId = properties.getProperty(ROOT_FOLDER_PROPERTY);
  if (typeof secret !== "string" || secret.length < 32) fail("CONFIGURATION_ERROR");
  return { secret: secret, rootFolderId: requireId(rootFolderId, "rootFolderId") };
}

function constantTimeEquals(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, left, Utilities.Charset.UTF_8);
  const rightDigest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, right, Utilities.Charset.UTF_8);
  let difference = 0;
  for (let index = 0; index < leftDigest.length; index += 1) difference |= leftDigest[index] ^ rightDigest[index];
  return difference === 0;
}

function folderWithinRoot(folder, rootFolderId) {
  const queue = [folder];
  const visited = {};
  let inspected = 0;

  while (queue.length) {
    const current = queue.shift();
    const currentId = current.getId();
    if (currentId === rootFolderId) return true;
    if (visited[currentId]) continue;
    visited[currentId] = true;
    inspected += 1;
    if (inspected > MAX_PARENT_NODES) fail("SCOPE_CHECK_FAILED");

    const parents = current.getParents();
    while (parents.hasNext()) queue.push(parents.next());
  }

  return false;
}

function allowedFolder(folderId, rootFolderId) {
  const id = requireId(folderId, "parentId");
  let folder;
  try {
    folder = DriveApp.getFolderById(id);
  } catch (error) {
    fail("RESOURCE_NOT_FOUND");
  }
  if (!folderWithinRoot(folder, rootFolderId)) fail("OUTSIDE_ROOT");
  return folder;
}

function fileHasParent(file, parentId) {
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === parentId) return true;
  }
  return false;
}

function allowedJsonFile(fileId, rootFolderId) {
  const id = requireId(fileId, "fileId");
  let file;
  try {
    file = DriveApp.getFileById(id);
  } catch (error) {
    fail("RESOURCE_NOT_FOUND");
  }
  if (file.isTrashed()) fail("RESOURCE_NOT_FOUND");
  if (file.getMimeType() === SHORTCUT_MIME_TYPE || !file.getName().endsWith(".json")) fail("INVALID_FILE");

  const parents = file.getParents();
  while (parents.hasNext()) {
    if (folderWithinRoot(parents.next(), rootFolderId)) return file;
  }
  fail("OUTSIDE_ROOT");
}

function findFolder(parentId, name, rootFolderId) {
  const parent = allowedFolder(parentId, rootFolderId);
  const folders = parent.getFoldersByName(requireName(name, "name", false));
  if (!folders.hasNext()) return null;
  const folder = folders.next();
  return { id: folder.getId(), name: folder.getName(), mimeType: FOLDER_MIME_TYPE };
}

function handle(action, input, rootFolderId) {
  if (action === "getJson") {
    const file = allowedJsonFile(input.fileId, rootFolderId);
    try {
      return JSON.parse(file.getBlob().getDataAsString("UTF-8"));
    } catch (error) {
      fail("INVALID_JSON_FILE");
    }
  }

  if (action === "listJson") {
    const files = allowedFolder(input.parentId, rootFolderId).getFiles();
    const result = [];
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() !== SHORTCUT_MIME_TYPE && file.getName().endsWith(".json") && !file.isTrashed()) {
        result.push({ id: file.getId(), name: file.getName(), mimeType: JSON_MIME_TYPE });
      }
    }
    return result;
  }

  if (action === "findFolder") return findFolder(input.parentId, input.name, rootFolderId);

  if (action === "createFolder") {
    const parent = allowedFolder(input.parentId, rootFolderId);
    return parent.createFolder(requireName(input.name, "name", false)).getId();
  }

  if (action === "upsertJson") {
    const parent = allowedFolder(input.parentId, rootFolderId);
    const parentId = parent.getId();
    const name = requireName(input.name, "name", true);
    if (typeof input.value === "undefined") fail("INVALID_VALUE");

    const content = JSON.stringify(input.value);
    if (typeof content !== "string") fail("INVALID_VALUE");

    if (input.fileId) {
      const file = allowedJsonFile(input.fileId, rootFolderId);
      if (!fileHasParent(file, parentId)) fail("OUTSIDE_PARENT");
      file.setName(name);
      file.setContent(content);
      return file.getId();
    }

    return parent.createFile(name, content, MimeType.PLAIN_TEXT).getId();
  }

  if (action === "delete") {
    allowedJsonFile(input.fileId, rootFolderId).setTrashed(true);
    return true;
  }

  fail("UNKNOWN_ACTION");
}

function safeAction(value) {
  const actions = ["getJson", "listJson", "findFolder", "createFolder", "upsertJson", "delete"];
  return actions.indexOf(value) >= 0 ? value : "unknown";
}

function doPost(event) {
  let input;
  let action = "unknown";
  try {
    const raw = event && event.postData && event.postData.contents;
    if (typeof raw !== "string" || !raw || raw.length > MAX_REQUEST_LENGTH) fail("INVALID_REQUEST");
    try {
      input = JSON.parse(raw);
    } catch (error) {
      fail("INVALID_REQUEST");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_REQUEST");

    action = safeAction(input.action);
    const config = configuration();
    if (!constantTimeEquals(input.secret, config.secret)) return jsonOutput({ ok: false, error: "UNAUTHORIZED" });
    if (action === "unknown") fail("UNKNOWN_ACTION");

    return jsonOutput({ ok: true, result: handle(action, input, config.rootFolderId) });
  } catch (error) {
    const code = error && error.safeCode ? error.safeCode : "OPERATION_FAILED";
    console.error(JSON.stringify({ type: "perfect_prospect_drive_error", action: action, code: code }));
    return jsonOutput({ ok: false, error: code });
  }
}
