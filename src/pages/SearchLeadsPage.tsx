import { AlertTriangle, AtSign, BadgeCheck, Building2, Check, CircleX, Clock3, Copy, ExternalLink, Globe2, History, Lightbulb, LoaderCircle, MapPin, MessageSquareText, Search, Smartphone, Sparkles, UserRoundSearch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { friendlySearchError, importProspects, listProspectDecisions, recordProspectDecision, searchProspects } from "../services/search";
import type { ProspectCandidate, ProspectDecisionRecord, ProspectDecisionScope, VerificationClassification } from "../types/search";

const cities = ["Cascavel", "Pindoretama", "Aquiraz", "Eusébio"];
const segments = [
  "Clínicas e consultórios", "Estética e beleza", "Restaurantes", "Pousadas e hotéis", "Imobiliárias",
  "Academias", "Escolas e cursos", "Lojas e comércio local", "Turismo e experiências", "Serviços automotivos",
];
const initialCities = ["Cascavel", "Aquiraz", "Eusébio"];
const initialSegments = ["Clínicas e consultórios", "Estética e beleza", "Pousadas e hotéis", "Restaurantes"];
const rejectionReasons = ["Empresa inativa ou não localizada", "Sem oportunidade comercial verificável", "Órgão público / contratação específica", "Dados inconsistentes", "Já abordada por outro processo", "Contato pertence a outra empresa", "Contato não funciona"];

function whatsappUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

function researchUrl(candidate: ProspectCandidate, decisionMaker = false): string {
  const suffix = decisionMaker ? " dono proprietário fundador diretor decisor" : " Instagram site WhatsApp";
  return `https://www.google.com/search?q=${encodeURIComponent(`${candidate.companyName} ${candidate.city}${suffix}`)}`;
}

function analysisPrompt(candidate: ProspectCandidate): string {
  return `Analise este prospect para a Perfect Evolution usando pesquisa web em fontes públicas. Não invente informações e sinalize tudo que não puder confirmar.

PROSPECT
- Empresa: ${candidate.companyName}
- Segmento: ${candidate.segment}
- Cidade: ${candidate.city}
- Endereço: ${candidate.address ?? "não localizado"}
- Telefone público: ${candidate.phone ?? "não localizado"}
- Instagram: ${candidate.instagram ?? "não localizado"}
- Site: ${candidate.website ?? "não localizado"}
- Perfil da fonte: ${candidate.mapsUrl ?? "não localizado"}
- Sinais iniciais: ${candidate.signals.join("; ")}
- Classificação da verificação: ${candidate.verification.classification}
- Confiança: ${candidate.verification.confidence}
- Situação do telefone: ${candidate.verification.phone.status} — ${candidate.verification.phone.reason}
- Situação do endereço: ${candidate.verification.address.status} — ${candidate.verification.address.reason}
- Instagram: ${candidate.verification.instagram.status} — ${candidate.verification.instagram.reason}
- Site: ${candidate.verification.website.status} — ${candidate.verification.website.reason}
- Restrições: ${candidate.verification.procurementRestriction ?? "nenhuma identificada"}
- Incertezas: ${candidate.verification.uncertainties.join("; ")}
- Evidências registradas: ${candidate.verification.evidence.map((item) => `${item.field}: ${item.statement} [${item.source}, ${item.observedAt}]`).join(" | ")}

OBJETIVO
Encontrar uma oportunidade real de venda e o caminho mais próximo possível até o dono ou decisor. Não escolha uma oferta antecipadamente: recomende a solução com maior chance de gerar receita conforme o problema verificado.

MÉTODO PERFECT EVOLUTION
Mapear → Qualificar → Microdiagnóstico → Abordar → Conversar → Ofertar → Receber → Entregar → Upsell.
Avalie: capacidade aparente de pagar, oportunidade digital visível, atividade/reputação e acesso ao decisor.
A oferta rápida Perfect Link parte de R$497. Também existem campanha, site/landing page, conteúdo, design, vídeo e gestão recorrente.
A primeira mensagem deve buscar somente o primeiro “pode”. Solução e preço só depois de interesse. Não sugerir vídeo ou mockup antes da resposta. Trabalho não começa sem pagamento ou entrada.

ENTREGUE
1. Evidências públicas encontradas, com links.
2. Score de 0 a 100 e justificativa.
3. Problema mais provável e oportunidade comercial.
4. Melhor oferta e motivo — ou descarte se não houver boa oportunidade.
5. Nome/cargo do possível decisor e canal mais próximo, somente se verificável.
6. Tom ideal conforme o perfil da empresa.
7. Primeira mensagem curta, personalizada e assinada por Bruno Mendes, da Perfect Evolution.
8. Mensagem de microdiagnóstico para usar apenas se a pessoa responder “pode”.`;
}

export function SearchLeadsPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";
  const [selectedCities, setSelectedCities] = useState<string[]>(initialCities);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(initialSegments);
  const [candidates, setCandidates] = useState<ProspectCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deciding, setDeciding] = useState<string>();
  const [decisionDrafts, setDecisionDrafts] = useState<Record<string, { scope: ProspectDecisionScope; reason: string }>>({});
  const [recentDecisions, setRecentDecisions] = useState<ProspectDecisionRecord[]>([]);
  const [classificationFilter, setClassificationFilter] = useState<"all" | VerificationClassification>("all");
  const requestCount = selectedCities.length;
  const validSearch = selectedCities.length > 0 && selectedSegments.length > 0;
  const selectedCandidates = useMemo(() => candidates.filter((candidate) => selected.has(candidate.externalId)), [candidates, selected]);
  const classificationCounts = useMemo(() => ({ qualified: candidates.filter((item) => item.verification.classification === "qualified").length, pending: candidates.filter((item) => item.verification.classification === "pending").length, discarded: candidates.filter((item) => item.verification.classification === "discarded").length }), [candidates]);
  const visibleCandidates = useMemo(() => classificationFilter === "all" ? candidates : candidates.filter((item) => item.verification.classification === classificationFilter), [candidates, classificationFilter]);

  useEffect(() => { void listProspectDecisions().then(setRecentDecisions).catch(() => undefined); }, []);

  function toggle(value: string, values: string[], setter: (values: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function runSearch() {
    if (!validSearch) return;
    setSearching(true); setError(""); setNotice(""); setSelected(new Set()); setClassificationFilter("all");
    try {
      const results = await searchProspects(selectedCities, selectedSegments);
      setCandidates(results);
      if (!results.length) setNotice("A fonte não retornou empresas para estes filtros. Tente outros segmentos.");
    } catch (reason) { setError(friendlySearchError(reason)); setCandidates([]); }
    finally { setSearching(false); }
  }

  async function importSelected() {
    if (!selectedCandidates.length) return;
    setImporting(true); setError(""); setNotice("");
    try {
      const result = await importProspects(selectedCandidates);
      const importedIds = new Set(result.leads.map((lead) => lead.externalId).filter(Boolean));
      setCandidates((current) => current.filter((candidate) => !importedIds.has(candidate.externalId) && !result.skipped.includes(candidate.externalId)));
      setSelected(new Set());
      setNotice(`${result.leads.length} ${result.leads.length === 1 ? "lead aprovado e preparado" : "leads aprovados e preparados"} para contato${result.skipped.length ? `; ${result.skipped.length} já estavam na base` : ""}.`);
    } catch (reason) { setError(friendlySearchError(reason)); }
    finally { setImporting(false); }
  }

  async function approveCandidate(candidate: ProspectCandidate) {
    setDeciding(candidate.externalId); setError(""); setNotice("");
    try {
      const result = await importProspects([candidate]);
      setCandidates((current) => current.filter((item) => item.externalId !== candidate.externalId));
      setNotice(result.leads.length ? `${candidate.companyName} foi aprovado e salvo no CRM.` : `${candidate.companyName} já estava no CRM.`);
      setRecentDecisions(await listProspectDecisions());
    } catch (reason) { setError(friendlySearchError(reason)); }
    finally { setDeciding(undefined); }
  }

  function openDecision(candidate: ProspectCandidate) {
    setDecisionDrafts((current) => ({ ...current, [candidate.externalId]: current[candidate.externalId] ?? { scope: "company", reason: "Dados inconsistentes" } }));
  }

  async function rejectCandidate(candidate: ProspectCandidate) {
    const draft = decisionDrafts[candidate.externalId];
    if (!draft) return;
    setDeciding(candidate.externalId); setError(""); setNotice("");
    try {
      const action = draft.scope === "contact" ? "contact_invalidated" : "rejected";
      const decision = await recordProspectDecision({ externalId: candidate.externalId, action, scope: draft.scope, reason: draft.reason, fingerprint: candidate.verification.fingerprint });
      setRecentDecisions((current) => [decision, ...current.filter((item) => item.externalId !== decision.externalId)].slice(0, 100));
      if (draft.scope === "company") {
        setCandidates((current) => current.filter((item) => item.externalId !== candidate.externalId));
        setNotice(`${candidate.companyName} não foi aprovado e não voltará enquanto os dados permanecerem iguais.`);
      } else {
        setCandidates((current) => current.map((item) => item.externalId === candidate.externalId ? {
          ...item,
          opportunityScore: Math.max(0, item.opportunityScore - item.commercialAssessment.contactReliability),
          signals: ["Contato invalidado — localizar outro canal", ...item.signals.filter((signal) => !signal.toLocaleLowerCase("pt-BR").includes("telefone"))],
          commercialAssessment: { ...item.commercialAssessment, contactReliability: 0 },
          verification: { ...item.verification, classification: "pending", phone: { status: "invalid", reason: draft.reason } },
        } : item));
        setNotice(`O contato de ${candidate.companyName} foi invalidado; a empresa continua disponível para nova verificação.`);
      }
      setDecisionDrafts((current) => { const next = { ...current }; delete next[candidate.externalId]; return next; });
    } catch (reason) { setError(friendlySearchError(reason)); }
    finally { setDeciding(undefined); }
  }

  async function copyAnalysis(candidate: ProspectCandidate) {
    try { await navigator.clipboard.writeText(analysisPrompt(candidate)); setNotice(`Briefing de ${candidate.companyName} copiado. Cole no ChatGPT para analisar.`); }
    catch { setError("O navegador não permitiu copiar. Tente novamente após autorizar a área de transferência."); }
  }

  return <div className="page search-page">
    <header className="page-title-row">
      <div><span className="eyebrow">Prospecção semiautomática</span><h1>Buscar, qualificar e aprovar</h1><p>O sistema encontra empresas, prepara o diagnóstico e a primeira mensagem. Você decide quem entra no CRM.</p></div>
      <span className="source-badge"><Globe2 size={16} /> Overture Maps · gratuito</span>
    </header>

    <section className="search-builder">
      <div className="search-filter-group"><header><strong>1. Regiões</strong><span>{selectedCities.length} selecionadas</span></header><div className="choice-grid cities-grid">
        {cities.map((city) => <label className={selectedCities.includes(city) ? "choice-card selected" : "choice-card"} key={city}><input type="checkbox" checked={selectedCities.includes(city)} onChange={() => toggle(city, selectedCities, setSelectedCities)} /><MapPin size={16} /><span>{city}</span><Check size={15} /></label>)}
      </div></div>
      <div className="search-filter-group"><header><strong>2. Segmentos com contato direto</strong><span>Uma consulta por cidade, com vários resultados</span></header><div className="choice-grid segment-grid">
        {segments.map((segment) => <label className={selectedSegments.includes(segment) ? "choice-card selected" : "choice-card"} key={segment}><input type="checkbox" checked={selectedSegments.includes(segment)} onChange={() => toggle(segment, selectedSegments, setSelectedSegments)} /><Building2 size={16} /><span>{segment}</span><Check size={15} /></label>)}
      </div></div>
      <footer className="search-runner"><div><strong>{requestCount} {requestCount === 1 ? "consulta gratuita" : "consultas gratuitas"}</strong><span>Busca, score, microdiagnóstico e mensagem inicial são preparados automaticamente.</span></div><button className="solid-button" disabled={!canEdit || !validSearch || searching} onClick={() => void runSearch()}>{searching ? <LoaderCircle className="spin" size={18} /> : <Search size={18} />}{searching ? "Executando prospecção…" : "Executar prospecção"}</button></footer>
    </section>

    {error && <div className="data-alert search-alert" role="alert"><span>{error}</span><button onClick={() => setError("")}>Fechar</button></div>}
    {notice && <div className="success-alert" role="status"><Check size={18} /><span>{notice}</span>{notice.includes("aprovado") && <Link to="/app/leads">Ir para contatos</Link>}</div>}

    {recentDecisions.length > 0 && <details className="decision-history"><summary><History size={16} /> Histórico de decisões ({recentDecisions.length})</summary><div>{recentDecisions.slice(0, 12).map((record) => <p key={record.latest.id}><strong>{record.latest.action === "approved" ? "Aprovado" : record.latest.action === "rejected" ? "Empresa não aprovada" : "Contato invalidado"}</strong><span>{record.externalId}</span><small>{record.latest.reason} · {new Date(record.latest.occurredAt).toLocaleString("pt-BR")}</small></p>)}</div></details>}

    <section className="prospect-surface" aria-live="polite">
      <header className="prospect-toolbar"><div><strong>{candidates.length ? `${candidates.length} oportunidades verificadas` : "Fila de aprovação"}</strong><span>Revise evidências e incertezas antes de decidir.</span>{candidates.length > 0 && <div className="classification-tabs"><button className={classificationFilter === "all" ? "active" : ""} onClick={() => setClassificationFilter("all")}>Todas {candidates.length}</button><button className={classificationFilter === "qualified" ? "active qualified" : "qualified"} onClick={() => setClassificationFilter("qualified")}>Qualificadas {classificationCounts.qualified}</button><button className={classificationFilter === "pending" ? "active pending" : "pending"} onClick={() => setClassificationFilter("pending")}>Pendentes {classificationCounts.pending}</button><button className={classificationFilter === "discarded" ? "active discarded" : "discarded"} onClick={() => setClassificationFilter("discarded")}>Descartadas {classificationCounts.discarded}</button></div>}</div>{candidates.length > 0 && <div className="selection-actions"><button className="ghost-button" onClick={() => setSelected(selected.size === visibleCandidates.length ? new Set() : new Set(visibleCandidates.map((candidate) => candidate.externalId)))}>{selected.size === visibleCandidates.length ? "Desmarcar visíveis" : "Selecionar visíveis"}</button><button className="solid-button" disabled={!selected.size || importing} onClick={() => void importSelected()}>{importing ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{importing ? "Preparando…" : `Aprovar ${selected.size || "selecionados"}`}</button></div>}</header>
      {searching ? <div className="data-state"><LoaderCircle className="spin" size={30} /><h2>Consultando empresas reais</h2><p>A busca cruza regiões e segmentos e ordena os resultados pelos sinais comerciais disponíveis.</p></div> : candidates.length === 0 ? <div className="data-state empty"><span className="empty-illustration"><Sparkles size={30} /></span><h2>Sua próxima lista começa aqui</h2><p>Escolha as regiões e segmentos acima. Nenhum contato será realizado sem aprovação humana.</p></div> : <div className="prospect-list">
        {visibleCandidates.map((candidate) => <article className={selected.has(candidate.externalId) ? "prospect-card selected" : "prospect-card"} key={candidate.externalId}>
          <label className="prospect-select"><input type="checkbox" checked={selected.has(candidate.externalId)} onChange={() => { const next = new Set(selected); next.has(candidate.externalId) ? next.delete(candidate.externalId) : next.add(candidate.externalId); setSelected(next); }} /><span><Check size={14} /></span></label>
          <div className={`opportunity-score score-${candidate.opportunityScore >= 75 ? "high" : candidate.opportunityScore >= 50 ? "medium" : "low"}`}><strong>{candidate.opportunityScore}</strong><small>potencial</small></div>
          <div className="prospect-main"><div className="prospect-title"><div><strong>{candidate.companyName}</strong><span>{candidate.segment} · {candidate.city}</span></div><span className={`verification-badge ${candidate.verification.classification}`}>{candidate.verification.classification === "qualified" ? <BadgeCheck size={14} /> : candidate.verification.classification === "discarded" ? <CircleX size={14} /> : <Clock3 size={14} />}{candidate.verification.classification === "qualified" ? "Qualificado para análise" : candidate.verification.classification === "discarded" ? "Descartado" : "Verificação pendente"}</span></div><p><MapPin size={14} /> {candidate.address ?? "Endereço não informado"} · {candidate.verification.address.reason}</p>{candidate.verification.procurementRestriction && <p className="procurement-warning"><AlertTriangle size={14} /> {candidate.verification.procurementRestriction}</p>}<div className="signal-list">{candidate.signals.slice(0, 5).map((signal) => <span key={signal}>{signal}</span>)}</div><div className="score-evidence"><span>Investimento <strong>{candidate.commercialAssessment.investmentPotential}/20</strong></span><span>Atividade <strong>{candidate.commercialAssessment.activityReputation}/20</strong></span><span>Digital <strong>{candidate.commercialAssessment.digitalOpportunity}/20</strong></span><span>Contato <strong>{candidate.commercialAssessment.contactReliability}/20</strong></span><span>Decisor <strong>{candidate.commercialAssessment.decisionMakerAccess}/20</strong></span></div><div className="auto-qualification"><p><Lightbulb size={14} /><span><strong>Oportunidade</strong>{candidate.qualification.opportunity}</span></p><p><UserRoundSearch size={14} /><span><strong>Melhor caminho</strong>{candidate.qualification.contactRoute}</span></p><p><MessageSquareText size={14} /><span><strong>Incertezas</strong>{candidate.verification.uncertainties.slice(0, 2).join(" ")}</span></p></div></div>
          <div className="prospect-channels">{candidate.phone && candidate.verification.phone.status === "confirmed_whatsapp" ? <a href={whatsappUrl(candidate.phone)} target="_blank" rel="noreferrer"><Smartphone size={15} /> Abrir WhatsApp confirmado<ExternalLink size={12} /></a> : candidate.phone ? <span className="unverified-channel"><Smartphone size={15} /> {candidate.phone} · {candidate.verification.phone.reason}</span> : null}{candidate.instagram && <a href={candidate.instagram.startsWith("http") ? candidate.instagram : `https://instagram.com/${candidate.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer"><AtSign size={15} /> Instagram {candidate.verification.instagram.status === "probable" ? "provável" : "não confirmado"}<ExternalLink size={12} /></a>}{candidate.website && <a href={candidate.website} target="_blank" rel="noreferrer"><Globe2 size={15} /> Site {candidate.verification.website.status === "probable" ? "provável" : "não confirmado"}<ExternalLink size={12} /></a>}{candidate.mapsUrl && <a href={candidate.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={15} /> Ver no mapa <ExternalLink size={12} /></a>}<a href={researchUrl(candidate, true)} target="_blank" rel="noreferrer"><UserRoundSearch size={15} /> Verificar decisor <ExternalLink size={12} /></a><button className="analysis-copy-button" onClick={() => void copyAnalysis(candidate)}><Copy size={15} /> Copiar análise para o ChatGPT</button><div className="prospect-decision-actions"><button className="approve-prospect-button" disabled={deciding === candidate.externalId} onClick={() => void approveCandidate(candidate)}><Check size={15} /> Aprovar prospect</button><button className="reject-prospect-button" disabled={deciding === candidate.externalId} onClick={() => openDecision(candidate)}><CircleX size={15} /> Não aprovar</button></div>{decisionDrafts[candidate.externalId] && <div className="decision-form"><label>Decisão sobre<select value={decisionDrafts[candidate.externalId].scope} onChange={(event) => setDecisionDrafts((current) => ({ ...current, [candidate.externalId]: { ...current[candidate.externalId], scope: event.target.value as ProspectDecisionScope } }))}><option value="company">A empresa</option><option value="contact">Somente o contato</option></select></label><label>Motivo<select value={decisionDrafts[candidate.externalId].reason} onChange={(event) => setDecisionDrafts((current) => ({ ...current, [candidate.externalId]: { ...current[candidate.externalId], reason: event.target.value } }))}>{rejectionReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label><button onClick={() => void rejectCandidate(candidate)} disabled={deciding === candidate.externalId}>{deciding === candidate.externalId ? "Salvando…" : "Confirmar decisão"}</button></div>}</div>
        </article>)}
      </div>}
      <footer className="osm-attribution">Dados da <a href="https://docs.overturemaps.org/attribution/" target="_blank" rel="noreferrer">Overture Maps Foundation e seus provedores</a>. Recorte local atualizado em outubro de 2026.</footer>
    </section>
  </div>;
}
