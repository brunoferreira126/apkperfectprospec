import { calculateScore, type ScoreBreakdown } from "../config/scoring.ts";

export interface QualificationInput {
  companyName: string;
  segment: string;
  city: string;
  phone?: string;
  website?: string;
  instagram?: string;
  address?: string;
}

export interface ProspectQualification {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  summary: string;
  identifiedProblem: string;
  opportunity: string;
  recommendedOffer: string;
  reasoning: string;
  tone: string;
  contactRoute: string;
  approachMessage: string;
}

const highValueSegments = new Set(["Clínicas e consultórios", "Pousadas e hotéis", "Imobiliárias"]);

function toneFor(segment: string): string {
  if (segment === "Clínicas e consultórios") return "Profissional, confiável e direto, sem prometer resultados clínicos.";
  if (segment === "Estética e beleza") return "Próximo, cuidadoso e visual, valorizando a experiência da cliente.";
  if (segment === "Pousadas e hotéis" || segment === "Turismo e experiências") return "Acolhedor e comercial, com foco na jornada até a reserva.";
  if (segment === "Restaurantes") return "Objetivo e dinâmico, com foco em facilitar descoberta, pedido ou reserva.";
  if (segment === "Imobiliárias") return "Consultivo e profissional, com foco em confiança e geração de contatos.";
  return "Próximo, respeitoso e objetivo, como uma conversa entre empresas da região.";
}

export function qualifyProspect(input: QualificationInput): ProspectQualification {
  const hasDirectChannel = Boolean(input.phone || input.instagram);
  const scoreBreakdown: ScoreBreakdown = {
    commercialFit: highValueSegments.has(input.segment) ? 25 : 20,
    digitalOpportunity: input.website ? 14 : 27,
    decisionMakerAccess: input.phone && input.instagram ? 23 : hasDirectChannel ? 17 : 6,
    activityReputation: input.address ? 10 : 7,
  };
  const score = calculateScore(scoreBreakdown);
  const identifiedProblem = input.website
    ? "Existe presença digital, mas ainda é preciso verificar se ela conduz o interessado com clareza até o contato, pedido, agendamento ou reserva."
    : "Nenhum site foi identificado na fonte pública; informações importantes podem estar espalhadas e depender demais do atendimento manual.";
  const opportunity = input.website
    ? "Revisar a jornada entre descoberta e contato e corrigir o ponto que estiver causando perda de oportunidades."
    : "Criar um caminho comercial simples que apresente a empresa e leve o interessado mais preparado ao canal de atendimento.";
  const recommendedOffer = input.website ? "Diagnóstico comercial — oferta definida após a conversa" : "Perfect Link";
  const reasoning = input.website
    ? "Como já existe um site, a solução não deve ser escolhida antes de verificar o gargalo real."
    : "O Perfect Link é uma entrada de baixo risco para organizar apresentação, diferenciais e chamada para contato.";
  const contactRoute = input.instagram
    ? "Direct do Instagram público"
    : input.phone
      ? "WhatsApp ou telefone público; confirmar se fala com o decisor"
      : "Pesquisar perfil do proprietário ou outro canal direto antes de abordar";
  const approachMessage = `Olá, pessoal da ${input.companyName}! Tudo bem? Aqui é o Bruno Mendes, da Perfect Evolution. Somos da região e dei uma olhada na presença digital de vocês em ${input.city}. Percebi uma oportunidade de melhorar o caminho entre quem conhece a empresa e quem realmente entra em contato. Pensei em uma ideia específica para vocês. Posso te mostrar? É bem rapidinho e sem compromisso.`;

  return {
    score,
    scoreBreakdown,
    summary: `${input.companyName} foi pré-qualificada com dados públicos. ${hasDirectChannel ? "Há um canal de contato disponível." : "O acesso ao decisor ainda precisa ser localizado."}`,
    identifiedProblem,
    opportunity,
    recommendedOffer,
    reasoning,
    tone: toneFor(input.segment),
    contactRoute,
    approachMessage,
  };
}
