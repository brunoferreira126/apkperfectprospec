interface ScoreInput {
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
}

export function scoreProspect(input: ScoreInput): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 20;

  if (input.businessStatus === "OPERATIONAL") { score += 10; signals.push("Empresa em operação"); }
  if (input.phone) { score += 25; signals.push("Contato telefônico disponível"); }
  else signals.push("Contato direto ainda não localizado");

  if (!input.website) { score += 25; signals.push("Sem site identificado — oportunidade digital"); }
  else { score += 8; signals.push("Possui site para avaliação comercial"); }

  const reviews = input.reviewCount ?? 0;
  if (reviews >= 100) { score += 12; signals.push("Alta atividade e prova social"); }
  else if (reviews >= 20) { score += 8; signals.push("Atividade pública relevante"); }
  else if (reviews > 0) { score += 4; signals.push("Presença pública validada"); }

  if ((input.rating ?? 0) >= 4.2) { score += 8; signals.push("Boa reputação pública"); }
  else if ((input.rating ?? 0) >= 3.5) score += 4;

  return { score: Math.min(score, 100), signals };
}

