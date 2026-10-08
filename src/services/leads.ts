import type { Interaction, Lead, LeadInput, LeadStatus } from "../types/lead";

export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init, headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) } });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new ApiError(body.error ?? "REQUEST_FAILED", response.status);
  return body as T;
}

export interface LeadFilters { query?: string; city?: string; segment?: string; status?: LeadStatus | "" }

export async function listLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const body = await request<{ leads: Lead[] }>(`/api/leads${params.size ? `?${params}` : ""}`);
  return body.leads;
}

export async function getLead(id: string): Promise<{ lead: Lead; history: Interaction[] }> {
  return request(`/api/leads?id=${encodeURIComponent(id)}`);
}

export async function createLead(input: LeadInput): Promise<Lead> {
  return (await request<{ lead: Lead }>("/api/leads", { method: "POST", body: JSON.stringify(input) })).lead;
}

export async function updateLead(id: string, expectedVersion: number, input: Partial<LeadInput>): Promise<Lead> {
  return (await request<{ lead: Lead }>(`/api/leads?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ ...input, expectedVersion }) })).lead;
}

export async function deleteLead(id: string): Promise<void> {
  await request<void>(`/api/leads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function analyzeLead(id: string, expectedVersion: number): Promise<Lead> {
  return (await request<{ lead: Lead }>("/api/analyze-lead", { method: "POST", body: JSON.stringify({ id, expectedVersion }) })).lead;
}

export function friendlyLeadError(error: unknown): string {
  if (!(error instanceof ApiError)) return "Não foi possível concluir a operação.";
  if (error.code === "STORAGE_NOT_CONFIGURED") return "O Google Drive ainda não foi configurado.";
  if (error.code === "LEAD_VERSION_CONFLICT") return "Este lead foi alterado em outra sessão. Recarregue os dados e tente novamente.";
  if (error.code === "INVALID_LEAD_DATA") return "Revise os campos preenchidos e tente novamente.";
  if (error.code === "TOO_MANY_REQUESTS") return "Muitas alterações em pouco tempo. Aguarde alguns minutos.";
  if (error.code === "AI_NOT_CONFIGURED") return "A inteligência artificial ainda não foi configurada no servidor.";
  if (error.code === "AI_RATE_LIMITED") return "O limite temporário de análises foi atingido. Tente novamente mais tarde.";
  if (error.code === "AI_REFUSED") return "A análise não pôde ser concluída com os dados disponíveis.";
  if (error.code === "AI_INVALID_RESPONSE") return "A IA respondeu fora do formato seguro. Nenhum dado foi salvo.";
  if (error.code === "AI_UNAVAILABLE") return "O serviço de IA está indisponível no momento.";
  return "Não foi possível acessar os dados agora.";
}
