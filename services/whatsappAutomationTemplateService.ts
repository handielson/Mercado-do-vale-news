import { vpsClient } from './vpsClient';

export type WhatsAppAutomationTemplateCategory = 'transactional' | 'promotional' | 'informational' | 'future';

export interface WhatsAppAutomationTemplate {
  id?: string;
  template_key: string;
  category: WhatsAppAutomationTemplateCategory;
  title: string;
  description: string;
  content: string;
  enabled: boolean;
  variables: string[];
  created_at?: string;
  updated_at?: string;
}

interface WhatsAppAutomationTemplateRow extends Omit<WhatsAppAutomationTemplate, 'enabled' | 'variables'> {
  enabled?: boolean | number;
  variables?: string[] | string;
  variables_json?: string[] | string | null;
}

interface TableDataResponse<T> {
  rows?: T[];
  data?: T[];
  items?: T[];
}

const COMMON_CUSTOMER_VARIABLES = ['nome', 'cpf', 'telefone', 'endereco', 'maps_link'];

export const WHATSAPP_AUTOMATION_TEMPLATE_DEFAULTS: WhatsAppAutomationTemplate[] = [
  {
    template_key: 'customer_registered_site',
    category: 'transactional',
    title: 'Cadastro realizado pelo site',
    description: 'Enviado quando o cliente conclui o cadastro pelo site.',
    enabled: true,
    variables: [...COMMON_CUSTOMER_VARIABLES, 'portal_link'],
    content: [
      '🎉 Cadastro realizado com sucesso!',
      '',
      'Que bom ter voce como cliente, {nome}! Seja bem-vindo(a) ao Mercado do Vale. 💚',
      '',
      'CPF: {cpf}',
      '',
      '📍 Endereco cadastrado:',
      '{endereco}',
      '{maps_link}',
      '',
      '✨ Agora voce ja pode acompanhar suas compras, garantias e beneficios pelo nosso sistema:',
      '{portal_link}',
    ].join('\n'),
  },
  {
    template_key: 'customer_registered_admin',
    category: 'transactional',
    title: 'Cadastro via admin com senha temporaria',
    description: 'Enviado quando a equipe cadastra o cliente pelo admin ou PDV.',
    enabled: true,
    variables: [...COMMON_CUSTOMER_VARIABLES, 'portal_link', 'senha_temporaria'],
    content: [
      '🎉 Cadastro realizado com sucesso!',
      '',
      'Que bom ter voce como cliente, {nome}! Seja bem-vindo(a) ao Mercado do Vale. 💚',
      '',
      'CPF: {cpf}',
      '',
      '📍 Endereco cadastrado:',
      '{endereco}',
      '{maps_link}',
      '',
      '🔐 Acesso ao sistema:',
      'Link: {portal_link}',
      'Senha temporaria: {senha_temporaria}',
      '',
      'Por seguranca, troque sua senha no primeiro acesso. ✨',
    ].join('\n'),
  },
  {
    template_key: 'sale_completed',
    category: 'transactional',
    title: 'Compra realizada com sucesso',
    description: 'Enviado apos venda PDV ou pedido online confirmado.',
    enabled: true,
    variables: ['nome', 'pedido', 'data', 'itens', 'pagamento', 'subtotal', 'desconto', 'frete', 'total', 'serializados', 'endereco_entrega', 'maps_link', 'observacao_entrega'],
    content: [
      '🛍️ Compra realizada com sucesso!',
      '',
      'Obrigado pela preferencia, {nome}! Seu pedido {pedido} ja esta registrado com a gente. 🚀',
      '',
      'Data: {data}',
      '',
      '📦 Itens:',
      '{itens}',
      '',
      '💳 Pagamento:',
      '{pagamento}',
      '',
      'Subtotal: {subtotal}',
      'Desconto: {desconto}',
      'Entrega/Frete: {frete}',
      'Total: {total}',
      '',
      '🔎 Seriais/IMEIs:',
      '{serializados}',
      '',
      '📍 Entrega:',
      '{endereco_entrega}',
      '{maps_link}',
      '{observacao_entrega}',
      '',
      'Qualquer duvida, estamos por aqui. 💚',
    ].join('\n'),
  },
  {
    template_key: 'birthday_greeting',
    category: 'transactional',
    title: 'Feliz aniversario',
    description: 'Enviado para clientes aniversariantes do dia.',
    enabled: true,
    variables: ['nome', 'cupom', 'validade_cupom'],
    content: [
      '🥳 Feliz aniversario, {nome}!',
      '',
      'Hoje e seu dia e toda a equipe Mercado do Vale deseja muita alegria, saude e conquistas. 💚',
      '',
      '🎁 Cupom especial: {cupom}',
      'Validade: {validade_cupom}',
      '',
      'Quando quiser escolher seu presente, estamos te esperando. ✨',
    ].join('\n'),
  },
  {
    template_key: 'delivery_out_for_delivery',
    category: 'transactional',
    title: 'Pedido saiu para entrega',
    description: 'Enviado quando o entregador marca que esta saindo para rota.',
    enabled: true,
    variables: ['nome', 'data', 'pedido', 'entregador', 'endereco_entrega', 'maps_link'],
    content: [
      'Obaa! 🚚✨',
      '',
      '{nome}, seu pedido saiu para entrega e ja esta na rota.',
      '',
      'Data: {data}',
      'Numero do pedido: {pedido}',
      'Entregador: {entregador}',
      '',
      '📍 Endereco:',
      '{endereco_entrega}',
      '{maps_link}',
      '',
      'Fique de olho no telefone. 💚',
    ].join('\n'),
  },
  {
    template_key: 'promotional_campaign',
    category: 'promotional',
    title: 'Campanha promocional',
    description: 'Espaco para ofertas, cupons e campanhas futuras.',
    enabled: false,
    variables: ['nome', 'titulo_promocao', 'oferta', 'cupom', 'validade', 'link'],
    content: [
      '🔥 {titulo_promocao}',
      '',
      'Oi, {nome}! Temos uma oferta especial esperando por voce:',
      '{oferta}',
      '',
      '🎟️ Cupom: {cupom}',
      'Valido ate: {validade}',
      '',
      'Confira aqui: {link}',
    ].join('\n'),
  },
  {
    template_key: 'informational_notice',
    category: 'informational',
    title: 'Comunicado informativo',
    description: 'Espaco para avisos de horario, loja, atendimento ou novidades.',
    enabled: false,
    variables: ['nome', 'titulo', 'mensagem', 'link'],
    content: [
      '📣 {titulo}',
      '',
      'Oi, {nome}!',
      '{mensagem}',
      '',
      'Mais detalhes: {link}',
      '',
      'Mercado do Vale 💚',
    ].join('\n'),
  },
  {
    template_key: 'post_sale_followup',
    category: 'future',
    title: 'Pos-venda',
    description: 'Espaco para acompanhamento apos compra.',
    enabled: false,
    variables: ['nome', 'pedido', 'produto', 'link_avaliacao'],
    content: [
      '✨ Oi, {nome}! Passando para saber se esta tudo certo com seu pedido {pedido}.',
      '',
      'Produto: {produto}',
      '',
      'Sua opiniao ajuda muito a gente:',
      '{link_avaliacao}',
    ].join('\n'),
  },
  {
    template_key: 'warranty_reminder',
    category: 'future',
    title: 'Lembrete de garantia',
    description: 'Espaco para comunicacoes sobre garantia e documentos.',
    enabled: false,
    variables: ['nome', 'produto', 'pedido', 'garantia_ate', 'portal_link'],
    content: [
      '🛡️ Lembrete de garantia',
      '',
      'Oi, {nome}! Seu produto {produto}, pedido {pedido}, possui garantia registrada ate {garantia_ate}.',
      '',
      'Voce pode consultar documentos e comprovantes aqui:',
      '{portal_link}',
    ].join('\n'),
  },
];

function extractRows<T>(response: TableDataResponse<T> | T[]): T[] {
  if (Array.isArray(response)) return response;
  return response.rows || response.data || response.items || [];
}

function parseVariables(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeTemplate(row: WhatsAppAutomationTemplateRow): WhatsAppAutomationTemplate {
  const fallback = WHATSAPP_AUTOMATION_TEMPLATE_DEFAULTS.find(item => item.template_key === row.template_key);
  return {
    ...fallback,
    ...row,
    category: (row.category || fallback?.category || 'future') as WhatsAppAutomationTemplateCategory,
    enabled: row.enabled === true || row.enabled === 1,
    variables: parseVariables(row.variables_json ?? row.variables ?? fallback?.variables),
    content: row.content || fallback?.content || '',
    description: row.description || fallback?.description || '',
    title: row.title || fallback?.title || row.template_key,
  };
}

function serializeTemplate(template: WhatsAppAutomationTemplate): Record<string, unknown> {
  return {
    template_key: template.template_key,
    category: template.category,
    title: template.title,
    description: template.description,
    content: template.content,
    enabled: template.enabled ? 1 : 0,
    variables_json: JSON.stringify(template.variables || []),
  };
}

export function previewWhatsAppAutomationTemplate(template: WhatsAppAutomationTemplate): string {
  const samples: Record<string, string> = {
    nome: 'Maria Silva',
    cpf: '***.***.**0-00',
    telefone: '(87) 99999-9999',
    endereco: 'Rua Exemplo, 123 - Centro, Petrolina/PE - CEP 56300-000',
    maps_link: 'https://maps.google.com/?q=Rua%20Exemplo%20123',
    portal_link: 'https://mv.mercadodovale.com.br/',
    senha_temporaria: '12345',
    pedido: '#A1B2C3D4',
    data: '20/06/2026 14:30',
    itens: '- Smartphone Exemplo x1 - R$ 1.999,00',
    pagamento: 'Pix - R$ 1.999,00',
    subtotal: 'R$ 1.999,00',
    desconto: 'R$ 0,00',
    frete: 'R$ 30,00',
    total: 'R$ 2.029,00',
    serializados: 'IMEI1: ***********1234',
    endereco_entrega: 'Rua Exemplo, 123 - Centro, Petrolina/PE',
    observacao_entrega: 'Complemento: casa azul',
    cupom: 'ANIVER10',
    validade_cupom: '30/06/2026',
    entregador: 'Joao Entregas',
    titulo_promocao: 'Oferta relampago Mercado do Vale',
    oferta: 'Smartphones selecionados com condicao especial hoje.',
    validade: 'Hoje ate 18h',
    link: 'https://mercadodovale.com.br',
    titulo: 'Comunicado Mercado do Vale',
    mensagem: 'Hoje teremos atendimento em horario especial.',
    produto: 'Smartphone Exemplo',
    link_avaliacao: 'https://mercadodovale.com.br/avaliar',
    garantia_ate: '20/06/2027',
  };

  return (template.content || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => samples[key] || match);
}

export async function listWhatsAppAutomationTemplates(): Promise<WhatsAppAutomationTemplate[]> {
  const data = await vpsClient.get<TableDataResponse<WhatsAppAutomationTemplateRow>>('/table-data/whatsapp_automation_templates?limit=200&offset=0');
  const rows = extractRows(data).map(normalizeTemplate);
  const rowsByKey = new Map(rows.map(row => [row.template_key, row]));
  return WHATSAPP_AUTOMATION_TEMPLATE_DEFAULTS.map(defaultTemplate => rowsByKey.get(defaultTemplate.template_key) || defaultTemplate);
}

export async function saveWhatsAppAutomationTemplate(template: WhatsAppAutomationTemplate): Promise<WhatsAppAutomationTemplate> {
  const body = serializeTemplate(template);
  if (template.id) {
    const saved = await vpsClient.patch<WhatsAppAutomationTemplateRow>(
      `/table-data/whatsapp_automation_templates/${encodeURIComponent(template.id)}?pk=id`,
      body
    );
    return normalizeTemplate(saved);
  }

  const saved = await vpsClient.post<WhatsAppAutomationTemplateRow>('/table-data/whatsapp_automation_templates', {
    id: crypto.randomUUID(),
    ...body,
  });
  return normalizeTemplate(saved);
}

export async function resetWhatsAppAutomationTemplate(templateKey: string): Promise<WhatsAppAutomationTemplate> {
  const defaults = WHATSAPP_AUTOMATION_TEMPLATE_DEFAULTS.find(template => template.template_key === templateKey);
  if (!defaults) throw new Error('Template padrao nao encontrado');
  return saveWhatsAppAutomationTemplate(defaults);
}

export interface WhatsAppAutomationTemplateTestResult {
  status: 'sent' | 'failed';
  phone?: string;
  template_key?: string;
  error?: string;
}

export async function sendWhatsAppAutomationTemplateTest(template: WhatsAppAutomationTemplate): Promise<WhatsAppAutomationTemplateTestResult> {
  return vpsClient.post<WhatsAppAutomationTemplateTestResult>('/whatsapp/automation/test-send', serializeTemplate(template));
}