const COOKIE_NAME = "pp_session";

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

function cookie(request: Request, name: string): string | undefined {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim().split("=")).find(([key]) => key === name)?.[1];
}

async function verify(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || secret.length < 32) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), new TextEncoder().encode(payload));
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as { exp?: number };
    return valid && typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

interface EdgeContext { next(): Promise<Response> }

export default async (request: Request, context: EdgeContext) => {
  const env = (globalThis as typeof globalThis & { Netlify?: { env: { get(name: string): string | undefined } } }).Netlify;
  const secret = env?.env.get("SESSION_SECRET") ?? "";
  if (await verify(cookie(request, COOKIE_NAME), secret)) return context.next();
  const url = new URL("/login", request.url);
  url.searchParams.set("next", new URL(request.url).pathname);
  return Response.redirect(url, 302);
};
