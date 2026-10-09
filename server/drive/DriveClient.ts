interface DriveFile { id: string; name: string; mimeType: string }

interface AppsScriptConfig { url: string; secret: string }

interface AppsScriptResponse<T> { ok: boolean; result?: T; error?: string }

export class DriveClient {
  private accessToken?: { value: string; expiresAt: number };

  private required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`DRIVE_CONFIGURATION_MISSING:${name}`);
    return value;
  }

  private appsScriptConfig(): AppsScriptConfig | null {
    const url = process.env.GOOGLE_APPS_SCRIPT_URL;
    const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
    if (!url && !secret) return null;
    if (!url) throw new Error("DRIVE_CONFIGURATION_MISSING:GOOGLE_APPS_SCRIPT_URL");
    if (!secret) throw new Error("DRIVE_CONFIGURATION_MISSING:GOOGLE_APPS_SCRIPT_SECRET");
    if (!url.startsWith("https://")) throw new Error("DRIVE_CONFIGURATION_INVALID:GOOGLE_APPS_SCRIPT_URL");
    return { url, secret };
  }

  private async rpc<T>(config: AppsScriptConfig, action: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ secret: config.secret, action, ...payload }),
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`DRIVE_SCRIPT_REQUEST_FAILED:${response.status}`);
    const data = await response.json() as AppsScriptResponse<T>;
    if (!data.ok) throw new Error(`DRIVE_SCRIPT_FAILED:${data.error ?? "UNKNOWN"}`);
    return data.result as T;
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const body = new URLSearchParams({
      client_id: this.required("GOOGLE_CLIENT_ID"),
      client_secret: this.required("GOOGLE_CLIENT_SECRET"),
      refresh_token: this.required("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("DRIVE_AUTH_FAILED");
    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${await this.token()}`, ...(init.headers ?? {}) },
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`DRIVE_REQUEST_FAILED:${response.status}`);
    return response;
  }

  async getJson<T>(fileId: string): Promise<T> {
    const script = this.appsScriptConfig();
    if (script) return this.rpc<T>(script, "getJson", { fileId });
    const response = await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
    return response.json() as Promise<T>;
  }

  async listJson(parentId: string): Promise<DriveFile[]> {
    const script = this.appsScriptConfig();
    if (script) return this.rpc<DriveFile[]>(script, "listJson", { parentId });
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false and mimeType = 'application/json'`);
    const response = await this.request(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=1000`);
    return ((await response.json()) as { files: DriveFile[] }).files;
  }

  async findFolder(parentId: string, name: string): Promise<DriveFile | null> {
    const script = this.appsScriptConfig();
    if (script) return this.rpc<DriveFile | null>(script, "findFolder", { parentId, name });
    const escaped = name.replace(/'/g, "\\'");
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${escaped}'`);
    const response = await this.request(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=1`);
    return ((await response.json()) as { files: DriveFile[] }).files[0] ?? null;
  }

  async createFolder(parentId: string, name: string): Promise<string> {
    const script = this.appsScriptConfig();
    if (script) return this.rpc<string>(script, "createFolder", { parentId, name });
    const response = await this.request("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, parents: [parentId], mimeType: "application/vnd.google-apps.folder" }),
    });
    return ((await response.json()) as { id: string }).id;
  }

  async upsertJson(parentId: string, name: string, value: unknown, fileId?: string): Promise<string> {
    const script = this.appsScriptConfig();
    if (script) return this.rpc<string>(script, "upsertJson", { parentId, name, value, fileId });
    const boundary = `perfect_${crypto.randomUUID()}`;
    const metadata = fileId ? { name } : { name, parents: [parentId], mimeType: "application/json" };
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(value)}\r\n--${boundary}--`;
    const endpoint = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id";
    const response = await this.request(endpoint, {
      method: fileId ? "PATCH" : "POST",
      headers: { "content-type": `multipart/related; boundary=${boundary}` },
      body,
    });
    return ((await response.json()) as { id: string }).id;
  }

  async delete(fileId: string): Promise<void> {
    const script = this.appsScriptConfig();
    if (script) {
      await this.rpc<boolean>(script, "delete", { fileId });
      return;
    }
    await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  }
}
