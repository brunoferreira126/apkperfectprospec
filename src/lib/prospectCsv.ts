import type { ProspectCandidate } from "../types/search";

function safeCell(value: unknown): string {
  let text = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function prospectsToCsv(candidates: ProspectCandidate[]): string {
  const headers = [
    "Empresa", "Segmento", "Cidade", "Endereço", "Telefone público", "Estado do telefone",
    "Site", "Estado do site", "Instagram", "Estado do Instagram", "Classificação", "Confiança",
    "Score", "Fonte", "URL da fonte", "Data da verificação", "Decisão comercial",
  ];
  const rows = candidates.map((candidate) => [
    candidate.companyName, candidate.segment, candidate.city, candidate.address, candidate.phone,
    candidate.verification.phone.status, candidate.website, candidate.verification.website.status,
    candidate.instagram, candidate.verification.instagram.status, candidate.verification.classification,
    candidate.verification.confidence, candidate.opportunityScore, candidate.source, candidate.mapsUrl,
    candidate.verification.checkedAt, "Pendente de decisão humana",
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(safeCell).join(";")).join("\r\n")}`;
}

export function downloadProspectsCsv(candidates: ProspectCandidate[], filename = "perfect-prospect.csv"): void {
  const url = URL.createObjectURL(new Blob([prospectsToCsv(candidates)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
