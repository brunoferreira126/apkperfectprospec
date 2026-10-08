import { AtSign, Building2, ChevronRight, Filter, LoaderCircle, MapPin, Plus, Search, Smartphone, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { LeadForm } from "../components/LeadForm";
import { createLead, friendlyLeadError, listLeads, type LeadFilters } from "../services/leads";
import type { Lead, LeadInput, LeadStatus } from "../types/lead";
import { STATUS_LABELS } from "../types/lead";

const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function LeadsPage() {
  const { user } = useAuth();
  const canEdit = user?.role !== "VIEWER";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filters, setFilters] = useState<LeadFilters>({});
  const [applied, setApplied] = useState<LeadFilters>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setLeads(await listLeads(applied)); }
    catch (reason) { setError(friendlyLeadError(reason)); }
    finally { setLoading(false); }
  }, [applied]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!creating) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setCreating(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [creating]);

  async function submitLead(input: LeadInput) {
    setSaving(true); setError("");
    try {
      const lead = await createLead(input);
      setLeads((current) => [lead, ...current]);
      setCreating(false);
    } catch (reason) { setError(friendlyLeadError(reason)); }
    finally { setSaving(false); }
  }

  return <div className="page leads-page">
    <header className="page-title-row">
      <div><span className="eyebrow">Base comercial</span><h1>Leads</h1><p>Cadastre, organize e acompanhe empresas com histórico preservado.</p></div>
      {canEdit && <button className="solid-button" onClick={() => setCreating(true)}><Plus size={18} /> Novo lead</button>}
    </header>

    <form className="filter-bar" onSubmit={(event) => { event.preventDefault(); setApplied(filters); }}>
      <label className="search-control"><Search size={18} /><span className="sr-only">Pesquisar</span><input value={filters.query ?? ""} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar empresa, cidade ou segmento" /></label>
      <label><span className="sr-only">Status</span><select value={filters.status ?? ""} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as LeadStatus | "" }))}><option value="">Todos os status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span className="sr-only">Cidade</span><input value={filters.city ?? ""} onChange={(event) => setFilters((current) => ({ ...current, city: event.target.value }))} placeholder="Cidade" /></label>
      <label><span className="sr-only">Segmento</span><input value={filters.segment ?? ""} onChange={(event) => setFilters((current) => ({ ...current, segment: event.target.value }))} placeholder="Segmento" /></label>
      <button className="filter-button"><Filter size={17} /> Filtrar</button>
      {Object.values(applied).some(Boolean) && <button type="button" className="clear-filter" onClick={() => { setFilters({}); setApplied({}); }}>Limpar</button>}
    </form>

    {error && <div className="data-alert" role="alert"><span>{error}</span><button onClick={() => void load()}>Tentar novamente</button></div>}

    <section className="leads-surface" aria-live="polite">
      <div className="surface-meta"><strong>{loading ? "Carregando leads" : `${leads.length} ${leads.length === 1 ? "lead encontrado" : "leads encontrados"}`}</strong><span>Atualizados pelo histórico real</span></div>
      {loading ? <div className="data-state"><LoaderCircle className="spin" size={28} /><p>Buscando sua base comercial…</p></div> : leads.length === 0 ? <div className="data-state empty"><span className="empty-illustration"><Building2 size={30} /></span><h2>Nenhum lead por aqui</h2><p>{Object.values(applied).some(Boolean) ? "Ajuste os filtros para ampliar a busca." : canEdit ? "Cadastre a primeira empresa para começar sua base comercial." : "A base comercial ainda não possui empresas cadastradas."}</p>{canEdit && !Object.values(applied).some(Boolean) && <button className="solid-button" onClick={() => setCreating(true)}><Plus size={18} /> Cadastrar primeiro lead</button>}</div> : <div className="lead-list">
        {leads.map((lead) => <Link className="lead-row" to={`/app/leads/${lead.id}`} key={lead.id}>
          <span className="company-monogram">{lead.companyName.slice(0, 2).toUpperCase()}</span>
          <span className="company-cell"><strong>{lead.companyName}</strong><small><MapPin size={13} /> {lead.city}</small></span>
          <span className="segment-cell"><small>Segmento</small><strong>{lead.segment}</strong></span>
          <span className="channel-cell">{lead.instagram && <AtSign size={16} />}{lead.whatsapp && <Smartphone size={16} />}{!lead.instagram && !lead.whatsapp && <small>Sem canais</small>}</span>
          <span className={`status-pill status-${lead.status}`}>{STATUS_LABELS[lead.status]}</span>
          <span className="updated-cell"><small>Atualizado</small><span>{formatter.format(new Date(lead.updatedAt))}</span></span>
          <ChevronRight size={18} />
        </Link>)}
      </div>}
    </section>

    {creating && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setCreating(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="new-lead-title">
      <header><div><span className="eyebrow">Cadastro manual</span><h2 id="new-lead-title">Novo lead</h2><p>Registre apenas dados comerciais necessários.</p></div><button className="icon-button" onClick={() => setCreating(false)} aria-label="Fechar"><X size={20} /></button></header>
      <LeadForm submitting={saving} onSubmit={submitLead} onCancel={() => setCreating(false)} />
    </section></div>}
  </div>;
}
