import { vpsClient } from './vpsClient';

export type EmailTemplateCategory = 'sales' | 'marketing' | 'catalog' | 'auth' | 'custom';

export interface EmailTemplate {
    id: string;
    slug: string;
    name: string;
    category: EmailTemplateCategory;
    trigger_key: string | null;
    subject: string;
    preheader: string | null;
    html_body: string;
    text_body: string | null;
    variables: string[];
    active: boolean;
    is_system: boolean;
    created_at?: string;
    updated_at?: string;
}

export type EmailTemplateInput = Omit<EmailTemplate, 'created_at' | 'updated_at'>;

interface TableDataResponse {
    rows?: Array<Partial<EmailTemplate> & { variables?: unknown }>;
}

const nowId = () => `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        id: 'email-order-success',
        slug: 'order_success',
        name: 'Compra realizada com sucesso',
        category: 'sales',
        trigger_key: 'order_success',
        subject: 'Recebemos seu pedido #{pedido_numero}',
        preheader: 'Seu pedido foi registrado e ja esta em processamento.',
        html_body: `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <h1 style="font-size: 22px; margin: 0 0 12px;">Pedido confirmado</h1>
  <p>Ola, {{cliente_nome}}.</p>
  <p>Recebemos sua compra <strong>#{{pedido_numero}}</strong> no valor de <strong>{{pedido_total}}</strong>.</p>
  <p>{{pedido_itens}}</p>
  <p>Voce pode acompanhar tudo por aqui: <a href="{{pedido_link}}">ver pedido</a>.</p>
  <p style="font-size: 13px; color: #64748b;">Mercado do Vale</p>
</div>`,
        text_body: 'Ola, {{cliente_nome}}. Recebemos sua compra #{{pedido_numero}} no valor de {{pedido_total}}. Acompanhe: {{pedido_link}}',
        variables: ['{{cliente_nome}}', '{{pedido_numero}}', '{{pedido_total}}', '{{pedido_itens}}', '{{pedido_link}}'],
        active: true,
        is_system: true,
    },
    {
        id: 'email-promotions',
        slug: 'promotions',
        name: 'Promocoes',
        category: 'marketing',
        trigger_key: 'promotions',
        subject: '{{promocao_titulo}} no Mercado do Vale',
        preheader: 'Ofertas selecionadas para voce.',
        html_body: `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <h1 style="font-size: 24px; margin: 0 0 12px;">{{promocao_titulo}}</h1>
  <p>{{promocao_descricao}}</p>
  <p><a href="{{promocao_link}}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 16px; border-radius: 6px; text-decoration: none;">Ver ofertas</a></p>
  <p style="font-size: 13px; color: #64748b;">Valido ate {{promocao_validade}}.</p>
</div>`,
        text_body: '{{promocao_titulo}} - {{promocao_descricao}} Ver ofertas: {{promocao_link}}',
        variables: ['{{cliente_nome}}', '{{promocao_titulo}}', '{{promocao_descricao}}', '{{promocao_link}}', '{{promocao_validade}}'],
        active: true,
        is_system: true,
    },
    {
        id: 'email-new-items',
        slug: 'new_items',
        name: 'Itens novos',
        category: 'catalog',
        trigger_key: 'new_items',
        subject: 'Novidades chegaram ao Mercado do Vale',
        preheader: 'Confira os produtos que acabaram de entrar.',
        html_body: `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <h1 style="font-size: 22px; margin: 0 0 12px;">Novidades na loja</h1>
  <p>Ola, {{cliente_nome}}.</p>
  <p>Separamos os itens novos que chegaram hoje:</p>
  <div>{{produtos_novos}}</div>
  <p><a href="{{catalogo_link}}">Abrir catalogo</a></p>
</div>`,
        text_body: 'Novidades na loja: {{produtos_novos}}. Veja o catalogo: {{catalogo_link}}',
        variables: ['{{cliente_nome}}', '{{produtos_novos}}', '{{catalogo_link}}'],
        active: true,
        is_system: true,
    },
    {
        id: 'email-password-reset',
        slug: 'password_reset',
        name: 'Recuperacao de senha',
        category: 'auth',
        trigger_key: 'password_reset',
        subject: 'Redefinicao de senha - Mercado do Vale',
        preheader: 'Use o link para criar uma nova senha.',
        html_body: `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <p>Ola, {{cliente_nome}}.</p>
  <p>Recebemos uma solicitacao para redefinir sua senha no Mercado do Vale.</p>
  <p><a href="{{reset_link}}">Clique aqui para criar uma nova senha</a>.</p>
  <p>Este link expira em {{expira_em_minutos}} minutos.</p>
  <p>Se voce nao solicitou esta alteracao, ignore este e-mail.</p>
</div>`,
        text_body: 'Ola, {{cliente_nome}}. Use este link para criar uma nova senha: {{reset_link}}. Ele expira em {{expira_em_minutos}} minutos.',
        variables: ['{{cliente_nome}}', '{{reset_link}}', '{{expira_em_minutos}}'],
        active: true,
        is_system: true,
    },
    {
        id: 'email-password-changed',
        slug: 'password_changed',
        name: 'Senha alterada',
        category: 'auth',
        trigger_key: 'password_changed',
        subject: 'Senha alterada - Mercado do Vale',
        preheader: 'Aviso de seguranca da sua conta.',
        html_body: `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <p>Ola, {{cliente_nome}}.</p>
  <p>Sua senha do Mercado do Vale foi alterada com sucesso.</p>
  <p>Se foi voce, nenhuma acao adicional e necessaria. Para entrar novamente, acesse <a href="{{login_link}}">o login da sua conta</a>.</p>
  <p>Se voce nao fez esta alteracao, entre em contato com a loja imediatamente.</p>
</div>`,
        text_body: 'Ola, {{cliente_nome}}. Sua senha foi alterada. Se nao foi voce, entre em contato com a loja imediatamente.',
        variables: ['{{cliente_nome}}', '{{login_link}}'],
        active: true,
        is_system: true,
    },
    {
        id: 'email-registration-confirmation',
        slug: 'registration_confirmation',
        name: 'Confirmacao de cadastro',
        category: 'auth',
        trigger_key: 'registration_confirmation',
        subject: 'Confirme seu cadastro no Mercado do Vale',
        preheader: 'Falta pouco para ativar sua conta.',
        html_body: `<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
  <p>Ola, {{cliente_nome}}.</p>
  <p>Para confirmar seu cadastro no Mercado do Vale, clique no link abaixo:</p>
  <p><a href="{{confirmacao_link}}">Confirmar cadastro</a></p>
  <p>Se voce nao criou esta conta, ignore este e-mail.</p>
</div>`,
        text_body: 'Ola, {{cliente_nome}}. Confirme seu cadastro: {{confirmacao_link}}',
        variables: ['{{cliente_nome}}', '{{confirmacao_link}}'],
        active: true,
        is_system: true,
    },
];

function parseVariables(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
}

function normalizeTemplate(row: Partial<EmailTemplate> & { variables?: unknown }): EmailTemplate {
    return {
        id: row.id || nowId(),
        slug: row.slug || '',
        name: row.name || 'Template sem nome',
        category: (row.category as EmailTemplateCategory) || 'custom',
        trigger_key: row.trigger_key ?? null,
        subject: row.subject || '',
        preheader: row.preheader ?? null,
        html_body: row.html_body || '',
        text_body: row.text_body ?? null,
        variables: parseVariables(row.variables),
        active: row.active !== false && row.active !== 0,
        is_system: row.is_system === true || row.is_system === 1,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function serializeTemplate(template: EmailTemplateInput) {
    return {
        ...template,
        variables: JSON.stringify(template.variables || []),
        active: template.active ? 1 : 0,
        is_system: template.is_system ? 1 : 0,
    };
}

function mergeDefaults(rows: EmailTemplate[]): EmailTemplate[] {
    const existing = new Map(rows.map((template) => [template.slug, template]));
    return [
        ...DEFAULT_EMAIL_TEMPLATES.map((template) => existing.get(template.slug) || template),
        ...rows.filter((template) => !DEFAULT_EMAIL_TEMPLATES.some((entry) => entry.slug === template.slug)),
    ];
}

export const emailTemplatesService = {
    async listTemplates(): Promise<EmailTemplate[]> {
        const data = await vpsClient.get<TableDataResponse>('/table-data/email_templates?limit=200&offset=0');
        const rows = (data.rows || []).map(normalizeTemplate);
        return mergeDefaults(rows);
    },

    async saveTemplate(template: EmailTemplate): Promise<EmailTemplate> {
        const payload = serializeTemplate(template);
        const saved = await vpsClient.patch<Partial<EmailTemplate>>(
            `/table-data/email_templates/${encodeURIComponent(template.id)}?pk=id`,
            payload
        );
        return normalizeTemplate(saved);
    },

    async createTemplate(partial?: Partial<EmailTemplate>): Promise<EmailTemplate> {
        const template: EmailTemplateInput = {
            id: partial?.id || nowId(),
            slug: partial?.slug || `custom_${Date.now()}`,
            name: partial?.name || 'Novo template',
            category: partial?.category || 'custom',
            trigger_key: partial?.trigger_key ?? null,
            subject: partial?.subject || 'Assunto do e-mail',
            preheader: partial?.preheader || '',
            html_body: partial?.html_body || '<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">\n  <p>Ola, {{cliente_nome}}.</p>\n</div>',
            text_body: partial?.text_body || 'Ola, {{cliente_nome}}.',
            variables: partial?.variables || ['{{cliente_nome}}'],
            active: partial?.active ?? true,
            is_system: false,
        };
        const saved = await vpsClient.post<Partial<EmailTemplate>>('/table-data/email_templates', serializeTemplate(template));
        return normalizeTemplate(saved);
    },
};
