import type { Handler } from "@netlify/functions";
import { json } from "./_shared/http";

export const handler: Handler = async () => json(200, { ok: true, service: "perfect-prospect" });
