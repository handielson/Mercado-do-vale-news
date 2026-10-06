export const MARKETING_SECTIONS = [
  { id: 'overview', group: 'Início', label: 'Visão geral', title: 'O que você quer fazer?', description: 'Crie materiais, organize a divulgação e acompanhe as aprovações.' },
  { id: 'studio', group: 'Criar', label: 'Artes de produtos', title: 'Artes de produtos', description: 'Escolha um produto, personalize a arte e baixe o material pronto.' },
  { id: 'tables', group: 'Criar', label: 'Tabelas de celulares', title: 'Tabelas de celulares', description: 'Uma lista por fabricante, sem preço, à vista no Pix ou com preço no cartão.' },
  { id: 'calendar', group: 'Planejar', label: 'Calendário', title: 'Calendário de divulgação', description: 'Veja as publicações e aprovações de todos os canais em um só lugar.' },
  { id: 'campaigns', group: 'Planejar', label: 'Campanhas com IA', title: 'Campanhas com IA', description: 'Monte propostas de campanhas e revise os materiais antes de aprovar.' },
  { id: 'instagram', group: 'Agendar', label: 'Instagram', title: 'Agendar no Instagram', description: 'Escolha entre Stories em datas específicas e a programação semanal.' },
  { id: 'whatsapp', group: 'Agendar', label: 'WhatsApp', title: 'Agendar no WhatsApp', description: 'Programe o Status automático ou um lote de mídias em dias específicos.' },
  { id: 'facebook', group: 'Agendar', label: 'Marketplace', title: 'Facebook Marketplace', description: 'Prepare anúncios de produtos e organize sua publicação no Marketplace.' },
  { id: 'approvals', group: 'Revisar', label: 'Aprovações', title: 'Central de aprovações', description: 'Confira o conteúdo e autorize os lotes pendentes de publicação.' },
] as const;

export type MarketingTab = typeof MARKETING_SECTIONS[number]['id'];

export function resolveMarketingTab(value: string | null): MarketingTab {
  return MARKETING_SECTIONS.find(section => section.id === value)?.id ?? 'overview';
}
