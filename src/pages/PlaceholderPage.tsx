import { Construction } from "lucide-react";

export function PlaceholderPage({ title, step }: { title: string; step: string }) {
  return <div className="page placeholder-page"><div className="placeholder-icon"><Construction size={28} /></div><span className="eyebrow">Planejado para {step}</span><h1>{title}</h1><p>Esta área será ativada quando os critérios da etapa anterior estiverem validados.</p></div>;
}
