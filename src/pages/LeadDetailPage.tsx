import { ArrowLeft, AtSign, BrainCircuit, Building2, CalendarDays, Check, Copy, ExternalLink, FileText, HeartHandshake, Lightbulb, LoaderCircle, MapPin, MessageCircle, MessageSquareText, Pencil, Phone, Send, Sparkles, Target, Trash2, Trophy, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { LeadForm } from "../components/LeadForm";
import { whatsappUrl } from "../lib/whatsapp";
import { analyzeLead, deleteLead, friendlyLeadError, getLead, updateLead } from "../services/leads";
import type { Interaction, Lead, LeadInput, LeadStatus } from "../types/lead";
import { STATUS_LABELS } from "../types/lead";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });
const eventLabels: Record<Interaction["type"], string> = { LEAD_CREATED: "Lead cadastrado", LEAD_UPDATED: "Dados atualizados", STATUS_CHANGED: "Status alterado", AI_ANALYSIS_COMPLETED: "Análise de IA concluída" };

export function LeadDetailPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "ADMIN" || user?.role === "COMMERCIAL";
  const canDelete = user?.role === "ADMIN";
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [history, setHistory] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await getLead(id); setLead(data.lead); setMessageDraft(data.lead.generatedMessage ?? ""); setHistory(data.history); }
    catch (reason) { setError(friendlyLeadError(reason)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function save(input: Partial<LeadInput>) {
    if (!lead) return;
    setSaving(true); setError("");
    try { setLead(await updateLead(lead.id, lead.version, input)); setEditing(false); await load(); }
    catch (reason) { setError(friendlyLeadError(reason)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!lead) return;
    setSaving(true);
    try { await deleteLead(lead.id); navigate("/app/leads", { replace: true }); }
    catch (reason) { setError(friendlyLeadError(reason)); setConfirmingDelete(false); setSaving(false); }
  }

  async function runAnalysis() {
    if (!lead) return;
    setAnalyzing(true); setError("");
    try { setLead(await analyzeLead(lead.id, lead.version)); await load(); }
    catch (reason) { setError(friendlyLeadError(reason)); }
    finally { setAnalyzing(false); }
  }

  async function copyMessage() {
    if (!messageDraft) return;
    await navigator.clipboard.writeText(messageDraft);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function advance(status: LeadStatus) {
    await save({ status });
  }

  async function saveMessage() {
    if (!messageDraft.trim()) return;
    await save({ generatedMessage: messageDraft.trim() });
  }

  async function confirmPublicPhone() {
    const phone = lead?.contactEvidence?.publicPhone;
    if (!phone || !lead) return;
    await save({ whatsapp: phone, contactEvidence: { ...lead.contactEvidence, phoneStatus: "confirmed_whatsapp", phoneReason: "WhatsApp confirmado manualmente pela equipe." } });
  }

  async function confirmPublicInstagram() {
    const instagram = lead?.contactEvidence?.publicInstagram;
    if (!instagram || !lead) return;
    await save({ instagram, contactEvidence: { ...lead.contactEvidence, instagramStatus: "confirmed", instagramReason: "Perfil oficial confirmado manualmente pela equipe." } });
  }

  if (loading) return <div className="page data-state detail-loading"><LoaderCircle className="spin" size={30} /><p>Carregando lead…</p></div>;
  if (!lead) return <div className="page data-state detail-loading"><Building2 size={34} /><h1>Lead não encontrado</h1><p>{error || "Este registro não está mais disponível."}</p><Link className="ghost-button link-button" to="/app/leads">Voltar para leads</Link></div>;

  return <div className="page lead-detail-page">
    <Link className="back-link" to="/app/leads"><ArrowLeft size={17} /> Voltar para leads</Link>
    {error && <div className="data-alert" role="alert"><span>{error}</span><button onClick={() => void load()}>Recarregar</button></div>}
    <header className="lead-detail-header">
      <div className="detail-identity"><span className="company-monogram large">{lead.companyName.slice(0, 2).toUpperCase()}</span><div><span className="eyebrow">Lead · {lead.source}</span><h1>{lead.companyName}</h1><p><MapPin size={15} /> {lead.city} <i /> {lead.segment}</p></div></div>
      <div className="detail-actions">{canEdit ? <><button className="ai-button" disabled={analyzing} onClick={() => void runAnalysis()}>{analyzing ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{analyzing ? "Analisando…" : lead.analysis ? "Atualizar análise" : "Analisar com IA"}</button><label className="status-select"><span>Status</span><select value={lead.status} disabled={saving || analyzing} onChange={(event) => void save({ status: event.target.value as LeadStatus })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="ghost-button" onClick={() => setEditing(true)}><Pencil size={17} /> Editar</button></> : <span className={`status-pill status-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>}</div>
    </header>

    <CommercialProgress status={lead.status} />

    <div className="detail-layout">
      <div className="detail-main">
        {lead.analysis && lead.scoreBreakdown && typeof lead.score === "number" ? <>
          <section className="ai-analysis-card">
            <header><div><span className="eyebrow">Análise comercial</span><h2>Potencial identificado</h2></div><span className={`score-ring priority-${scorePriority(lead.score)}`} style={{ "--score": lead.score } as React.CSSProperties}><strong>{lead.score}</strong><small>/100</small></span></header>
            <p className="analysis-summary">{lead.analysis.summary}</p>
            <div className="score-bars">
              <ScoreBar label="Fit comercial" value={lead.scoreBreakdown.commercialFit} max={30} />
              <ScoreBar label="Oportunidade digital" value={lead.scoreBreakdown.digitalOpportunity} max={30} />
              <ScoreBar label="Acesso ao decisor" value={lead.scoreBreakdown.decisionMakerAccess} max={25} />
              <ScoreBar label="Atividade e reputação" value={lead.scoreBreakdown.activityReputation} max={15} />
            </div>
            <div className="analysis-grid">
              <article><span className="analysis-icon problem"><BrainCircuit size={19} /></span><div><small>Problema identificado</small><p>{lead.analysis.identifiedProblem}</p></div></article>
              <article><span className="analysis-icon opportunity"><Target size={19} /></span><div><small>Oportunidade</small><p>{lead.analysis.opportunity}</p></div></article>
              <article className="offer-recommendation"><span className="analysis-icon offer"><Lightbulb size={19} /></span><div><small>Oferta recomendada</small><strong>{lead.analysis.recommendedOffer}</strong><p>{lead.analysis.reasoning}</p></div></article>
            </div>
            <footer><span>Recomendação gerada em {dateTime.format(new Date(lead.analysis.analyzedAt))}</span><strong>A decisão final é humana.</strong></footer>
          </section>
          {lead.generatedMessage && <section className="approach-card"><header><div><span className="message-icon"><MessageSquareText size={20} /></span><div><span className="eyebrow">Abordagem sugerida</span><h2>Mensagem preparada para sua aprovação</h2></div></div><span className="draft-badge">{lead.status === "new" || lead.status === "qualified" ? "Aguardando aprovação" : lead.status === "contact_ready" ? "Aprovada" : "Em andamento"}</span></header>{canEdit ? <textarea className="approach-editor" value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} maxLength={2000} rows={6} aria-label="Mensagem comercial editável" /> : <blockquote>{messageDraft}</blockquote>}<div className="approach-actions"><p>Você mantém o controle: o sistema apenas abre o canal com o rascunho. Nada é enviado automaticamente; depois confirme manualmente o envio no CRM.</p><div className="phase-actions">{canEdit && messageDraft.trim() !== (lead.generatedMessage ?? "") && <button className="ghost-button" disabled={saving || !messageDraft.trim()} onClick={() => void saveMessage()}><Pencil size={16} /> Salvar mensagem</button>}<button className="ghost-button" onClick={() => void copyMessage()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copiado" : "Copiar mensagem"}</button>{lead.whatsapp && lead.status === "contact_ready" && <a className="ghost-button link-button" href={whatsappUrl(lead.whatsapp, messageDraft)} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Abrir WhatsApp — não envia</a>}{lead.instagram && lead.status === "contact_ready" && <a className="ghost-button link-button" href={instagramUrl(lead.instagram)} target="_blank" rel="noreferrer"><AtSign size={16} /> Abrir Instagram</a>}{canEdit && nextPhase(lead.status) && (() => { const action = nextPhase(lead.status)!; const Icon = action.icon; return <button className="solid-button" disabled={saving} onClick={() => void advance(action.status)}><Icon size={16} />{saving ? "Salvando…" : action.label}</button>; })()}</div></div></section>}
        </> : <section className="ai-empty-card"><span className="ai-orbit"><Sparkles size={27} /></span><div><span className="eyebrow">Inteligência comercial</span><h2>Descubra a melhor oportunidade para este lead</h2><p>A IA avalia os dados disponíveis, recomenda uma oferta e prepara uma abordagem. Nenhuma decisão ou contato é automático.</p></div>{canEdit && <button className="ai-button" disabled={analyzing} onClick={() => void runAnalysis()}>{analyzing ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{analyzing ? "Analisando…" : "Analisar lead"}</button>}</section>}
        {lead.contactEvidence && <section className="detail-card contact-evidence-card"><header><div><h2>Canais encontrados na busca</h2><p>Confirme o vínculo antes de tratar o canal como oficial.</p></div></header><div className="contact-evidence-list">
          {lead.contactEvidence.publicPhone && <div><span><Phone size={17} /><strong>{lead.contactEvidence.publicPhone}</strong><small>{lead.contactEvidence.phoneReason ?? "Telefone público ainda não confirmado."}</small></span>{lead.contactEvidence.phoneStatus === "conflict" || lead.contactEvidence.phoneStatus === "invalid" ? <em className="evidence-invalid">Não utilizar</em> : <><a className="ghost-button link-button" href={whatsappUrl(lead.contactEvidence.publicPhone, messageDraft)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> {lead.whatsapp ? "Abrir WhatsApp" : "Testar no WhatsApp"}</a>{lead.whatsapp ? <em className="evidence-confirmed"><Check size={14} /> WhatsApp confirmado</em> : canEdit ? <button className="ghost-button" disabled={saving} onClick={() => void confirmPublicPhone()}>Confirmar como WhatsApp</button> : <em>Pendente</em>}</>}</div>}
          {lead.contactEvidence.publicInstagram && <div><span><AtSign size={17} /><strong>{lead.contactEvidence.publicInstagram}</strong><small>{lead.contactEvidence.instagramReason ?? "Perfil ainda não confirmado."}</small></span><a className="ghost-button link-button" href={instagramUrl(lead.contactEvidence.publicInstagram)} target="_blank" rel="noreferrer">Verificar perfil <ExternalLink size={13} /></a>{lead.instagram ? <em className="evidence-confirmed"><Check size={14} /> Oficial confirmado</em> : canEdit && <button className="ghost-button" disabled={saving} onClick={() => void confirmPublicInstagram()}>Confirmar Instagram oficial</button>}</div>}
          {lead.contactEvidence.publicWebsite && <div><span><ExternalLink size={17} /><strong>Site associado pela fonte</strong><small>{lead.contactEvidence.websiteReason ?? "Verifique o vínculo com a empresa."}</small></span><a className="ghost-button link-button" href={lead.contactEvidence.publicWebsite} target="_blank" rel="noreferrer">Abrir site <ExternalLink size={13} /></a></div>}
        </div></section>}
        <section className="detail-card"><header><h2>Dados comerciais</h2></header><div className="info-grid">
          <Info icon={AtSign} label="Instagram" value={lead.instagram} />
          <Info icon={Phone} label="WhatsApp" value={lead.whatsapp} />
          <Info icon={ExternalLink} label="Site" value={lead.website} href={lead.website} />
          <Info icon={UserRound} label="Responsável" value={lead.decisionMaker?.name} secondary={lead.decisionMaker?.role} />
          <Info icon={Phone} label="Contato do responsável" value={lead.decisionMaker?.contact} />
          <Info icon={CalendarDays} label="Cadastrado em" value={dateTime.format(new Date(lead.createdAt))} />
        </div>{lead.notes && <div className="notes-block"><span>Observações</span><p>{lead.notes}</p></div>}</section>
        <section className="detail-card history-card"><header><h2>Histórico</h2><span>{history.length} {history.length === 1 ? "evento" : "eventos"}</span></header>{history.length === 0 ? <p className="muted-copy">Nenhum evento registrado.</p> : <ol className="timeline">{history.map((event) => <li key={event.id}><span className="timeline-dot" /><div><strong>{eventLabels[event.type]}</strong>{event.type === "STATUS_CHANGED" && <p>De {STATUS_LABELS[event.metadata.from as LeadStatus] ?? String(event.metadata.from)} para {STATUS_LABELS[event.metadata.to as LeadStatus] ?? String(event.metadata.to)}</p>}<small>{dateTime.format(new Date(event.occurredAt))}</small></div></li>)}</ol>}</section>
      </div>
      <aside className="detail-side"><section className="version-card"><span className="eyebrow">Integridade</span><strong>Versão {lead.version}</strong><p>Alterações concorrentes são detectadas antes de salvar.</p></section>{canDelete && <section className="danger-card"><h2>Excluir lead</h2><p>Remove os dados da empresa. O evento administrativo permanece nos logs de auditoria.</p><button className="danger-button" onClick={() => setConfirmingDelete(true)}><Trash2 size={16} /> Excluir</button></section>}</aside>
    </div>

    {editing && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-lead-title"><header><div><span className="eyebrow">Editar cadastro</span><h2 id="edit-lead-title">{lead.companyName}</h2></div><button className="icon-button" onClick={() => setEditing(false)} aria-label="Fechar"><X size={20} /></button></header><LeadForm lead={lead} submitting={saving} onSubmit={save} onCancel={() => setEditing(false)} /></section></div>}
    {confirmingDelete && <div className="modal-backdrop" role="presentation"><section className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><span className="danger-icon"><Trash2 size={23} /></span><h2 id="delete-title">Excluir {lead.companyName}?</h2><p>Esta ação remove o cadastro do Drive e não pode ser desfeita pela interface.</p><div className="form-actions"><button className="ghost-button" onClick={() => setConfirmingDelete(false)}>Cancelar</button><button className="danger-button filled" disabled={saving} onClick={() => void remove()}>{saving ? "Excluindo…" : "Excluir lead"}</button></div></section></div>}
  </div>;
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="score-bar"><div><span>{label}</span><strong>{value}<small>/{max}</small></strong></div><i><b style={{ width: `${(value / max) * 100}%` }} /></i></div>;
}

function scorePriority(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function instagramUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://instagram.com/${value.replace(/^@/, "")}`;
}

const commercialSteps: { status: LeadStatus; label: string }[] = [
  { status: "qualified", label: "Qualificado" },
  { status: "contact_ready", label: "Abordagem aprovada" },
  { status: "contacted", label: "Contato realizado" },
  { status: "responded", label: "Respondeu" },
  { status: "interested", label: "Interessado" },
  { status: "proposal", label: "Proposta" },
  { status: "won", label: "Venda" },
];

function CommercialProgress({ status }: { status: LeadStatus }) {
  const normalized = status === "new" ? "qualified" : status;
  const current = commercialSteps.findIndex((step) => step.status === normalized);
  const terminal = status === "lost" || status === "discarded";
  return <section className={`commercial-progress${terminal ? " terminal" : ""}`} aria-label="Progresso comercial">
    <header><strong>Progressão comercial</strong><span>{terminal ? STATUS_LABELS[status] : current >= 0 ? commercialSteps[current].label : STATUS_LABELS[status]}</span></header>
    <ol>{commercialSteps.map((step, index) => <li className={terminal ? "" : index < current ? "complete" : index === current ? "current" : ""} key={step.status}><i>{index < current ? <Check size={13} /> : index + 1}</i><span>{step.label}</span></li>)}</ol>
  </section>;
}

function nextPhase(status: LeadStatus): { status: LeadStatus; label: string; icon: typeof Send } | null {
  const actions: Partial<Record<LeadStatus, { status: LeadStatus; label: string; icon: typeof Send }>> = {
    new: { status: "contact_ready", label: "Aprovar abordagem", icon: Check },
    qualified: { status: "contact_ready", label: "Aprovar abordagem", icon: Check },
    contact_ready: { status: "contacted", label: "Marcar mensagem enviada", icon: Send },
    contacted: { status: "responded", label: "Registrar que respondeu", icon: MessageCircle },
    responded: { status: "interested", label: "Marcar interesse", icon: HeartHandshake },
    interested: { status: "proposal", label: "Marcar proposta enviada", icon: FileText },
    proposal: { status: "won", label: "Registrar venda", icon: Trophy },
  };
  return actions[status] ?? null;
}

function Info({ icon: Icon, label, value, secondary, href }: { icon: typeof AtSign; label: string; value?: string; secondary?: string; href?: string }) {
  return <div className="info-item"><span className="info-icon"><Icon size={18} /></span><div><small>{label}</small>{value ? href ? <a href={href} target="_blank" rel="noreferrer">{value} <ExternalLink size={12} /></a> : <strong>{value}</strong> : <span>Não informado</span>}{secondary && <em>{secondary}</em>}</div></div>;
}
