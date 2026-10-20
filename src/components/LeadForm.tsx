import { FormEvent, useState } from "react";
import type { Lead, LeadInput, LeadStatus } from "../types/lead";
import { STATUS_LABELS } from "../types/lead";

const empty: LeadInput = { companyName: "", segment: "", city: "", source: "Cadastro manual", status: "new" };

function fromLead(lead?: Lead): LeadInput {
  if (!lead) return empty;
  return { companyName: lead.companyName, segment: lead.segment, city: lead.city, source: lead.source, status: lead.status, instagram: lead.instagram, whatsapp: lead.whatsapp, website: lead.website, contactEvidence: lead.contactEvidence, decisionMaker: lead.decisionMaker, notes: lead.notes };
}

export function LeadForm({ lead, submitting, onSubmit, onCancel }: { lead?: Lead; submitting: boolean; onSubmit(input: LeadInput): Promise<void>; onCancel(): void }) {
  const [values, setValues] = useState<LeadInput>(() => fromLead(lead));
  const set = (field: keyof LeadInput, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const setDecision = (field: "name" | "role" | "contact", value: string) => setValues((current) => ({ ...current, decisionMaker: { ...current.decisionMaker, [field]: value } }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSubmit(values);
  }

  return <form className="lead-form" onSubmit={submit}>
    <div className="form-grid">
      <label className="span-2">Empresa <input value={values.companyName} onChange={(event) => set("companyName", event.target.value)} maxLength={160} required autoFocus /></label>
      <label>Segmento <input value={values.segment} onChange={(event) => set("segment", event.target.value)} placeholder="Ex.: Estética" maxLength={100} required /></label>
      <label>Cidade <input value={values.city} onChange={(event) => set("city", event.target.value)} placeholder="Ex.: Eusébio" maxLength={100} required /></label>
      <label>Origem <input value={values.source} onChange={(event) => set("source", event.target.value)} maxLength={100} required /></label>
      <label>Status <select value={values.status} onChange={(event) => set("status", event.target.value as LeadStatus)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <fieldset><legend>Canais comerciais</legend><div className="form-grid">
      <label>Instagram <input value={values.instagram ?? ""} onChange={(event) => set("instagram", event.target.value)} placeholder="@empresa" maxLength={160} /></label>
      <label>WhatsApp <input value={values.whatsapp ?? ""} onChange={(event) => set("whatsapp", event.target.value)} placeholder="+55 85 99999-9999" maxLength={30} /></label>
      <label className="span-2">Site <input value={values.website ?? ""} onChange={(event) => set("website", event.target.value)} placeholder="empresa.com.br" maxLength={300} /></label>
    </div></fieldset>
    <fieldset><legend>Responsável comercial</legend><div className="form-grid three-cols">
      <label>Nome <input value={values.decisionMaker?.name ?? ""} onChange={(event) => setDecision("name", event.target.value)} maxLength={100} /></label>
      <label>Cargo <input value={values.decisionMaker?.role ?? ""} onChange={(event) => setDecision("role", event.target.value)} maxLength={100} /></label>
      <label>Contato <input value={values.decisionMaker?.contact ?? ""} onChange={(event) => setDecision("contact", event.target.value)} maxLength={160} /></label>
    </div></fieldset>
    <label>Observações <textarea value={values.notes ?? ""} onChange={(event) => set("notes", event.target.value)} rows={4} maxLength={2000} /></label>
    <div className="form-actions"><button type="button" className="ghost-button" onClick={onCancel}>Cancelar</button><button className="solid-button" disabled={submitting}>{submitting ? "Salvando…" : lead ? "Salvar alterações" : "Cadastrar lead"}</button></div>
  </form>;
}
