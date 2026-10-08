interface DriveFile { id: string; name: string; mimeType: string }

export class DriveClient {
  private accessToken?: { value: string; expiresAt: number };

  private required(name: string): string {
    const value = process.env[name];
    if (!value) throw new Error(`DRIVE_CONFIGURATION_MISSING:${name}`);
    return value;
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
    const response = await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`);
    return response.json() as Promise<T>;
  }

  async listJson(parentId: string): Promise<DriveFile[]> {
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false and mimeType = 'application/json'`);
    const response = await this.request(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=1000`);
    return ((await response.json()) as { files: DriveFile[] }).files;
  }

  async findFolder(parentId: string, name: string): Promise<DriveFile | null> {
    const escaped = name.replace(/'/g, "\\'");
    const q = encodeURIComponent(`'${parentId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${escaped}'`);
    const response = await this.request(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType)&pageSize=1`);
    return ((await response.json()) as { files: DriveFile[] }).files[0] ?? null;
  }

  async createFolder(parentId: string, name: string): Promise<string> {
    const response = await this.request("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, parents: [parentId], mimeType: "application/vnd.google-apps.folder" }),
    });
    return ((await response.json()) as { id: string }).id;
  }

  async upsertJson(parentId: string, name: string, value: unknown, fileId?: string): Promise<string> {
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
    await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  }
}
