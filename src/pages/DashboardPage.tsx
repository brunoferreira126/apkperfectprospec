import { ArrowUpRight, Check, MessageSquareText, ShieldCheck, Sparkles, Target } from "lucide-react";
import { Link } from "react-router-dom";

const foundations = [
  { icon: Sparkles, title: "Score validado", text: "Quatro critérios, com total recalculado pelo servidor.", tone: "teal" },
  { icon: Target, title: "Oferta recomendada", text: "A análise escolhe apenas produtos ativos da Perfect.", tone: "blue" },
  { icon: MessageSquareText, title: "Abordagem personalizada", text: "Rascunho contextualizado, sempre sujeito à revisão humana.", tone: "orange" },
];

export function DashboardPage() {
  return (
    <div className="page dashboard-page">
      <section className="welcome-row">
        <div><span className="eyebrow">Etapa 3 · Inteligência</span><h1>Bom dia, Bruno.</h1><p>Seus leads agora podem receber análise, score e uma abordagem personalizada.</p></div>
        <div className="stage-chip"><span>03</span><div><small>Etapa atual</small><strong>Motor de IA</strong></div></div>
      </section>

      <section className="foundation-grid">
        {foundations.map(({ icon: Icon, title, text, tone }) => <article className="foundation-card" key={title}><span className={`icon-box ${tone}`}><Icon size={21} /></span><div><h2>{title}</h2><p>{text}</p></div><Check size={18} className="check" /></article>)}
      </section>

      <section className="dashboard-split">
        <article className="next-step-card">
          <div className="card-heading"><div><span className="eyebrow">Etapa ativa</span><h2>Analise sua próxima oportunidade</h2></div><span className="step-number">03</span></div>
          <div className="progress-track stage-three"><i /></div>
          <div className="next-content"><div><strong>Inteligência com controle humano</strong><p>Abra um lead, solicite a análise e revise a abordagem antes de qualquer contato.</p></div><Link to="/app/leads">Escolher lead <ArrowUpRight size={17} /></Link></div>
        </article>
        <article className="guardrail-card">
          <ShieldCheck size={25} />
          <span className="eyebrow">Regra central</span>
          <blockquote>“A IA recomenda.<br /><em>O humano decide.</em>”</blockquote>
          <p>Nenhuma mensagem será enviada automaticamente.</p>
        </article>
      </section>

      <section className="empty-metrics">
        <div><span className="eyebrow">Visão comercial</span><h2>Seus resultados aparecerão aqui</h2><p>As métricas serão calculadas a partir dos dados reais, sem números fictícios.</p></div>
        <div className="metric-placeholders" aria-label="Métricas ainda sem dados"><span /><span /><span /><span /></div>
      </section>
    </div>
  );
}
