import { ApiError } from "./leads";
import type { Lead } from "../types/lead";
import type { ProspectCandidate, ProspectDecisionAction, ProspectDecisionRecord, ProspectDecisionScope } from "../types/search";

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(data.error ?? "REQUEST_FAILED", response.status);
  return data as T;
}

export async function searchProspects(cities: string[], segments: string[]): Promise<ProspectCandidate[]> {
  return (await post<{ candidates: ProspectCandidate[] }>("/api/search-leads", { cities, segments })).candidates;
}

export async function importProspects(candidates: ProspectCandidate[]): Promise<{ leads: Lead[]; existing: Lead[]; skipped: string[] }> {
  return post("/api/import-search-leads", { candidates });
}

export async function recordProspectDecision(input: { externalId: string; action: ProspectDecisionAction; scope: ProspectDecisionScope; reason: string; fingerprint: string }): Promise<ProspectDecisionRecord> {
  return (await post<{ decision: ProspectDecisionRecord }>("/api/prospect-decisions", input)).decision;
}

export async function listProspectDecisions(): Promise<ProspectDecisionRecord[]> {
  const response = await fetch("/api/prospect-decisions", { credentials: "include" });
  const body = await response.json().catch(() => ({})) as { decisions?: ProspectDecisionRecord[]; error?: string };
  if (!response.ok) throw new ApiError(body.error ?? "REQUEST_FAILED", response.status);
  return body.decisions ?? [];
}

export function friendlySearchError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Não foi possível concluir a busca agora.";
  if (error.code === "SEARCH_SOURCE_BUSY") return "A fonte gratuita está ocupada. Aguarde alguns minutos e tente novamente.";
  if (error.code === "STORAGE_NOT_CONFIGURED") return "A busca funcionou, mas o Google Drive ainda não está configurado para importar os leads.";
  if (error.code === "TOO_MANY_REQUESTS") return "Muitas buscas em sequência. Aguarde alguns minutos antes de tentar novamente.";
  if (error.code === "INVALID_IMPORT_DATA") return "Algum resultado não pôde ser importado. Refaça a busca e tente novamente.";
  if (error.code === "IMPORT_UNAVAILABLE") return "Não foi possível salvar o prospect no CRM. Tente novamente; se persistir, verifique a conexão com o Google Drive.";
  if (error.code === "STORAGE_UNAVAILABLE") return "O Google Drive demorou para responder. Tente novamente em alguns segundos.";
  return "A fonte gratuita de busca está temporariamente indisponível.";
}
