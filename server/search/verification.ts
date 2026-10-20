import { createHash } from "node:crypto";
import type { CommercialAssessment, ProspectEvidence, ProspectVerification, VerificationConfidence } from "./types.ts";

export interface VerifiablePlace {
  id: string;
  name: string;
  segment: string;
  city: string;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  latitude?: number;
  longitude?: number;
  confidence?: number | null;
}

const SNAPSHOT_DATE = "2026-10-01T00:00:00.000Z";
const publicEntityPattern = /\b(prefeitura|secretaria|c[aâ]mara municipal|governo|municipal|estadual|posto de sa[uú]de|upa|cras|creas|f[oó]rum|delegacia)\b/i;
const inactivePattern = /\b(fechad[oa]|encerrad[oa]|inativ[oa])\b/i;
const highValueSegments = new Set(["Clínicas e consultórios", "Pousadas e hotéis", "Imobiliárias"]);
const knownCities = ["cascavel", "pindoretama", "aquiraz", "eusebio", "fortaleza"];

function normalizePhone(value?: string | null): string | undefined {
  const digits = value?.replace(/\D/g, "");
  return digits && digits.length >= 8 ? digits : undefined;
}

function tokens(value: string): string[] {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
}

function linkedToName(value: string | null | undefined, companyName: string): boolean {
  if (!value) return false;
  const normalized = value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return tokens(companyName).some((token) => normalized.includes(token));
}

function fingerprint(place: VerifiablePlace): string {
  return createHash("sha256").update(JSON.stringify({
    name: place.name, city: place.city, address: place.address ?? null, phone: normalizePhone(place.phone),
    website: place.website ?? null, instagram: place.instagram ?? null, latitude: place.latitude ?? null, longitude: place.longitude ?? null,
  })).digest("hex");
}

function evidence(field: ProspectEvidence["field"], statement: string, confidence: VerificationConfidence, url?: string): ProspectEvidence {
  return { field, statement, confidence, source: "Overture Maps snapshot", observedAt: SNAPSHOT_DATE, ...(url ? { url } : {}) };
}

export function phoneOwnershipIndex(places: VerifiablePlace[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const place of places) {
    const phone = normalizePhone(place.phone);
    if (!phone) continue;
    const owners = index.get(phone) ?? new Set<string>();
    owners.add(place.name.trim().toLocaleLowerCase("pt-BR"));
    index.set(phone, owners);
  }
  return index;
}

export function verifyPlace(place: VerifiablePlace, phoneOwners: Map<string, Set<string>>, checkedAt = new Date().toISOString()): { verification: ProspectVerification; assessment: CommercialAssessment } {
  const sourceConfidence = place.confidence ?? 0;
  const publicEntity = publicEntityPattern.test(place.name);
  const inactive = inactivePattern.test(place.name);
  const normalizedPhone = normalizePhone(place.phone);
  const phoneConflict = Boolean(normalizedPhone && (phoneOwners.get(normalizedPhone)?.size ?? 0) > 1);
  const normalizedAddress = place.address?.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normalizedCity = place.city.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const mentionsOtherCity = Boolean(normalizedAddress && knownCities.some((city) => city !== normalizedCity && normalizedAddress.includes(city)));
  const addressStatus = !place.address ? "missing" : mentionsOtherCity ? "inconsistent" : "consistent";
  const instagramProbable = linkedToName(place.instagram, place.name);
  const websiteProbable = linkedToName(place.website, place.name);
  const identityStatus = sourceConfidence >= 0.8 && Boolean(place.name) ? "probable" : "unverified";
  const phoneStatus = !normalizedPhone ? "missing" : phoneConflict ? "conflict" : "public_unverified";
  const evidenceItems: ProspectEvidence[] = [
    evidence("identity", `Nome comercial registrado na fonte: ${place.name}.`, sourceConfidence >= 0.8 ? "high" : "medium"),
    evidence("address", place.address ? `Endereço informado pela fonte em ${place.city}.` : "A fonte não informou endereço.", addressStatus === "consistent" ? "high" : "low"),
    evidence("activity", "A presença no catálogo é um sinal de existência, não uma confirmação de atividade atual.", "low"),
  ];
  if (place.phone) evidenceItems.push(evidence("phone", phoneConflict ? "O mesmo telefone aparece associado a nomes empresariais diferentes." : "Telefone publicado pela fonte; WhatsApp e titularidade ainda não confirmados.", phoneConflict ? "low" : "medium"));
  if (place.website) evidenceItems.push(evidence("website", websiteProbable ? "Domínio tem correspondência textual com o nome da empresa." : "Site associado pela fonte, sem confirmação independente.", websiteProbable ? "medium" : "low", place.website));
  if (place.instagram) evidenceItems.push(evidence("instagram", instagramProbable ? "Perfil tem correspondência textual com o nome da empresa." : "Instagram associado pela fonte, sem confirmação independente.", instagramProbable ? "medium" : "low", place.instagram));
  if (publicEntity) evidenceItems.push(evidence("procurement", "O nome indica possível órgão ou estabelecimento público, sujeito a regras específicas de contratação.", "high"));

  const uncertainties = [
    "Atividade atual ainda não confirmada em fonte recente.",
    ...(phoneStatus === "public_unverified" ? ["O telefone não foi confirmado como WhatsApp nem como canal do decisor."] : []),
    ...(phoneStatus === "conflict" ? ["A titularidade do telefone é divergente."] : []),
    ...(place.instagram && !instagramProbable ? ["A associação do Instagram com a empresa precisa ser verificada."] : []),
    ...(place.website && !websiteProbable ? ["A associação do site com a empresa precisa ser verificada."] : []),
  ];

  const classification = inactive ? "discarded" : publicEntity || addressStatus !== "consistent" || phoneConflict || identityStatus === "unverified" ? "pending" : "qualified";
  const confidence: VerificationConfidence = classification === "qualified" && sourceConfidence >= 0.8 ? "high" : classification === "discarded" ? "high" : "medium";
  const investmentPotential = highValueSegments.has(place.segment) ? 17 : 13;
  const activityReputation = inactive ? 0 : sourceConfidence >= 0.8 ? 12 : 7;
  const digitalOpportunity = place.website ? 10 : 18;
  const contactReliability = phoneStatus === "public_unverified" ? 9 : phoneStatus === "conflict" ? 0 : 3;
  const decisionMakerAccess = instagramProbable ? 12 : normalizedPhone && !phoneConflict ? 7 : 3;
  const rawScore = investmentPotential + activityReputation + digitalOpportunity + contactReliability + decisionMakerAccess;
  const assessment: CommercialAssessment = {
    investmentPotential, activityReputation, digitalOpportunity, contactReliability, decisionMakerAccess,
    procurementRestriction: publicEntity ? "public_procurement" : "none",
    explanation: [
      `Potencial aparente: ${investmentPotential}/20, estimado pelo segmento — não por faturamento confirmado.`,
      `Atividade e reputação: ${activityReputation}/20, limitada pela data e pela única fonte disponível.`,
      `Oportunidade digital: ${digitalOpportunity}/20, baseada apenas nos canais publicados.`,
      `Confiabilidade de contato: ${contactReliability}/20; telefone público não equivale a WhatsApp confirmado.`,
      `Acesso ao decisor: ${decisionMakerAccess}/20; nenhum proprietário foi presumido.`,
    ],
    uncertainties,
  };
  const verification: ProspectVerification = {
    classification, confidence, checkedAt, fingerprint: fingerprint(place),
    identity: { status: identityStatus, reason: identityStatus === "probable" ? "Registro com boa confiança na fonte de origem." : "Identidade precisa de confirmação independente." },
    address: { status: addressStatus, reason: addressStatus === "consistent" ? "Cidade do endereço é compatível com o filtro." : addressStatus === "missing" ? "Endereço ausente." : "Endereço não confirma a cidade pesquisada." },
    activity: { status: inactive ? "inactive_signal" : "unknown", reason: inactive ? "O nome contém sinal explícito de encerramento." : "A fonte não confirma funcionamento atual." },
    phone: { status: phoneStatus, reason: phoneStatus === "conflict" ? "Telefone associado a empresas diferentes." : phoneStatus === "public_unverified" ? "Telefone público; WhatsApp e titularidade não confirmados." : "Telefone não localizado." },
    instagram: { status: !place.instagram ? "missing" : instagramProbable ? "probable" : "unverified", reason: !place.instagram ? "Instagram não localizado." : instagramProbable ? "Há correspondência textual; confirmar no perfil." : "Associação não confirmada." },
    website: { status: !place.website ? "missing" : websiteProbable ? "probable" : "unverified", reason: !place.website ? "Site não localizado." : websiteProbable ? "Há correspondência textual; confirmar no site." : "Associação não confirmada." },
    publicEntity,
    ...(publicEntity ? { procurementRestriction: "Verificar licitação, dispensa aplicável ou credenciamento antes de tratar como venda privada." } : {}),
    uncertainties, evidence: evidenceItems,
  };
  if (publicEntity && rawScore > 35) assessment.explanation.push("Score limitado na prioridade comercial devido à possível contratação pública.");
  return { verification, assessment };
}

export function assessmentScore(assessment: CommercialAssessment): number {
  const raw = assessment.investmentPotential + assessment.activityReputation + assessment.digitalOpportunity + assessment.contactReliability + assessment.decisionMakerAccess;
  return assessment.procurementRestriction === "public_procurement" ? Math.min(raw, 35) : Math.min(raw, 100);
}
