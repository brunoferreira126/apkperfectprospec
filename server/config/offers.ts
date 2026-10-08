export interface Offer {
  id: string;
  name: string;
  description: string;
  startingPrice?: number;
  active: boolean;
}

export const OFFERS: readonly Offer[] = [
  { id: "perfect-link", name: "Perfect Link", description: "Jornada digital para transformar interesse em contato ou agendamento.", startingPrice: 497, active: true },
  { id: "campanha-express", name: "Campanha Express", description: "Campanha pontual com objetivo e período definidos.", active: true },
  { id: "gestao-marketing", name: "Gestão de Marketing", description: "Planejamento e operação contínua da presença e aquisição digital.", active: true },
  { id: "perfect-q4", name: "Perfect Q4", description: "Estratégia comercial e de comunicação para o último trimestre.", active: true },
  { id: "landing-page", name: "Landing Page", description: "Página focada em uma oferta e conversão específica.", active: true },
  { id: "site", name: "Site", description: "Presença institucional completa, confiável e orientada ao negócio.", active: true },
  { id: "conteudo", name: "Conteúdo", description: "Conteúdo estratégico para fortalecer presença e relacionamento.", active: true },
  { id: "design", name: "Design", description: "Sistema visual e peças para comunicação profissional.", active: true },
  { id: "video", name: "Vídeo", description: "Conteúdo audiovisual para apresentar, demonstrar ou converter.", active: true },
] as const;

export function activeOffers(): Offer[] {
  return OFFERS.filter((offer) => offer.active);
}
