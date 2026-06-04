import React from 'react';
import {
    AlertCircle,
    BarChart3,
    Ban,
    Bot,
    CheckCircle2,
    Clock,
    Copy,
    Edit3,
    MessageCircle,
    MessageSquareText,
    Plus,
    RefreshCw,
    Save,
    Search,
    Settings,
    Tags,
    Trash2,
    Users,
    Wand2,
    X,
} from 'lucide-react';
import { Tabs, TabList, TabPanels } from '../../components/ui/Tabs';
import { Tab, TabPanel } from '../../components/ui/Tab';
import { autoResponderService } from '../../services/autoResponderService';
import type {
    AutoResponderAiTraining,
    AutoResponderAiTrainingInput,
    AutoResponderAiTrainingType,
    AutoResponderSettings,
    AutoResponderStats,
    AutoResponderStoreStatus,
    AutoResponderTestFlowResult,
    AutoResponderTestReplyResult,
    AutoResponderCategoryTag,
    AutoResponderConversation,
    AutoResponderBlocklistEntry,
    AutoResponderBlocklistInput,
    AutoResponderRule,
    AutoResponderRuleInput,
    AutoResponderTag,
    AutoResponderTagInput,
    AutoResponderUnansweredQuestion,
} from '../../types/autoResponder';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type RuleStatusFilter = 'all' | 'active' | 'inactive';
type ConversationStatusFilter = 'all' | 'active' | 'paused';

interface RuleFormState {
    name: string;
    pattern: string;
    match_type: string;
    reply_type: string;
    reply_text: string;
    reply_tag_id: string;
    reply_search_query: string;
    attachment_url: string;
    attachment_caption: string;
    priority: string;
    active: boolean;
    tag_ids: number[];
}

interface BlockFormState {
    pattern: string;
    pattern_type: string;
    contact_name: string;
    reason: string;
    active: boolean;
}

interface TagFormState {
    name: string;
    color: string;
    description: string;
    scopes: string[];
    show_on_bot: boolean;
}

interface AiTrainingFormState {
    title: string;
    training_type: AutoResponderAiTrainingType;
    content: string;
    priority: string;
    active: boolean;
}

interface SettingsFormState {
    enabled: boolean;
    human_message_in_hours: string;
    human_message_out_of_hours: string;
    human_pause_minutes: string;
    greeting_prefix: string;
    fallback_message: string;
    signature_enabled: boolean;
    signature_message: string;
    auto_pause_fallback_threshold: string;
    auto_pause_fallback_minutes: string;
    auto_pause_fallback_message: string;
    max_replies_per_conversation: string;
    max_replies_window_hours: string;
    send_product_images: boolean;
    max_images_per_response: string;
    use_numbered_lists: boolean;
    numbered_list_threshold: string;
    numbered_list_validity_minutes: string;
    conversation_flow_keywords: Record<string, string>;
    conversation_flow_messages: Record<string, string>;
    ai_enabled: boolean;
    ai_model: string;
    ai_daily_limit: string;
    ai_monthly_limit: string;
    ai_credit_balance_usd: string;
    ai_credit_alert_usd: string;
    ai_input_cost_per_1m_usd: string;
    ai_output_cost_per_1m_usd: string;
    openai_api_key: string;
    openai_api_key_masked: string;
    has_openai_api_key: boolean;
    openai_admin_api_key: string;
    openai_admin_api_key_masked: string;
    has_openai_admin_api_key: boolean;
    archive_to_synology: boolean;
    archive_after_days: string;
}

interface TagKeywordRow {
    id: string;
    tagId: string;
    keywords: string;
}

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    minRows?: number;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ minRows = 2, className = '', style, value, onChange, ...props }) => {
    const ref = React.useRef<HTMLTextAreaElement | null>(null);

    const resize = React.useCallback(() => {
        const textarea = ref.current;
        if (!textarea) return;
        const computed = window.getComputedStyle(textarea);
        const lineHeight = Number.parseFloat(computed.lineHeight) || 24;
        const paddingY = Number.parseFloat(computed.paddingTop) + Number.parseFloat(computed.paddingBottom);
        const borderY = Number.parseFloat(computed.borderTopWidth) + Number.parseFloat(computed.borderBottomWidth);
        const minHeight = (lineHeight * minRows) + paddingY + borderY;

        textarea.style.height = 'auto';
        textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
    }, [minRows]);

    React.useLayoutEffect(() => {
        resize();
    }, [resize, value]);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(event);
        requestAnimationFrame(resize);
    };

    return (
        <textarea
            {...props}
            ref={ref}
            value={value}
            onChange={handleChange}
            rows={minRows}
            className={`${className} resize-none overflow-hidden`}
            style={style}
        />
    );
};

const isEnabled = (value: unknown): boolean => value === true || value === 1 || value === '1';

const statusLabels: Record<string, string> = {
    open: 'Aberta',
    closing_soon: 'Fechando',
    closed: 'Fechada',
    holiday: 'Feriado',
};

const tabs = [
    { id: 'fluxos', label: 'Fluxos', icon: <MessageCircle size={16} /> },
    { id: 'respostas', label: 'Respostas', icon: <MessageSquareText size={16} /> },
    { id: 'conversas', label: 'Conversas', icon: <Users size={16} /> },
    { id: 'bloqueados', label: 'Bloqueados', icon: <Ban size={16} /> },
    { id: 'curadoria', label: 'Curadoria', icon: <Wand2 size={16} /> },
    { id: 'tags', label: 'Tags', icon: <Tags size={16} /> },
    { id: 'estatisticas', label: 'Estatísticas', icon: <BarChart3 size={16} /> },
    { id: 'testes', label: 'Testes', icon: <Bot size={16} /> },
    { id: 'treinamento-ia', label: 'Treinamento IA', icon: <Bot size={16} /> },
    { id: 'configuracoes', label: 'Configurações', icon: <Settings size={16} /> },
];

const emptyRuleForm: RuleFormState = {
    name: '',
    pattern: '',
    match_type: 'any_keyword',
    reply_type: 'text',
    reply_text: '',
    reply_tag_id: '',
    reply_search_query: '',
    attachment_url: '',
    attachment_caption: '',
    priority: '0',
    active: true,
    tag_ids: [],
};

const emptyBlockForm: BlockFormState = {
    pattern: '',
    pattern_type: 'exact',
    contact_name: '',
    reason: '',
    active: true,
};

const emptyTagForm: TagFormState = {
    name: '',
    color: '#2563eb',
    description: '',
    scopes: ['conversation'],
    show_on_bot: true,
};

const emptyAiTrainingForm: AiTrainingFormState = {
    title: '',
    training_type: 'store_instruction',
    content: '',
    priority: '0',
    active: true,
};

const emptySettingsForm: SettingsFormState = {
    enabled: true,
    human_message_in_hours: '',
    human_message_out_of_hours: '',
    human_pause_minutes: '60',
    greeting_prefix: '',
    fallback_message: '',
    signature_enabled: true,
    signature_message: 'Pitoco, assistente virtual do Mercado do Vale. Se precisar de ajuda personalizada, nossa equipe continua o atendimento por aqui.',
    auto_pause_fallback_threshold: '3',
    auto_pause_fallback_minutes: '30',
    auto_pause_fallback_message: '',
    max_replies_per_conversation: '20',
    max_replies_window_hours: '24',
    send_product_images: true,
    max_images_per_response: '1',
    use_numbered_lists: true,
    numbered_list_threshold: '2',
    numbered_list_validity_minutes: '30',
    conversation_flow_keywords: {
        phone_list_opt_in: 'sim, quero, manda, pode mandar, lista, quero ver, manda lista',
    },
    conversation_flow_messages: {
        greeting_reply: 'Bom dia! Seja bem-vindo ao Mercado do Vale.\nComo posso ajudar voce hoje?',
        phone_list_prompt: 'Voce esta atras de celular novo? Quer que eu mande a lista do que temos? Ou deseja alguma outra coisa?',
        phone_list_reply: 'Encontrei estas opcoes para celulares:',
        name_prompt: 'Qual seu nome para seguirmos com o atendimento?',
        product_choice_prompt: 'Responda com o numero da opcao ou com o nome/modelo do produto.',
        fulfillment_prompt: 'Agora preciso confirmar se sera retirada na loja ou entrega.',
        delivery_cep_prompt: 'Combinado: entrega. Me envie o CEP da entrega. Pode mandar somente os numeros.',
        pickup_reply: 'Combinado: retirada na loja. Agora vamos combinar a forma de pagamento.',
        payment_prompt: 'Como prefere pagar? Pix, dinheiro, debito ou cartao de credito?',
        human_handoff_reply: 'Vou chamar nossa equipe para continuar seu atendimento por aqui.',
    },
    ai_enabled: false,
    ai_model: 'gpt-5-nano',
    ai_daily_limit: '0',
    ai_monthly_limit: '0',
    ai_credit_balance_usd: '0',
    ai_credit_alert_usd: '5',
    ai_input_cost_per_1m_usd: '0',
    ai_output_cost_per_1m_usd: '0',
    openai_api_key: '',
    openai_api_key_masked: '',
    has_openai_api_key: false,
    openai_admin_api_key: '',
    openai_admin_api_key_masked: '',
    has_openai_admin_api_key: false,
    archive_to_synology: false,
    archive_after_days: '7',
};

const tagScopeOptions = [
    { id: 'conversation', label: 'Conversas' },
    { id: 'product', label: 'Produtos' },
    { id: 'rule', label: 'Regras' },
];

const ruleTemplates: Array<{ label: string; patch: Partial<RuleFormState> }> = [
    {
        label: 'Saudação',
        patch: {
            name: 'Saudação inicial',
            pattern: 'oi, ola, olá, bom dia, boa tarde, boa noite',
            match_type: 'any_keyword',
            reply_type: 'text',
            reply_text: 'Olá! Como posso ajudar?',
            priority: '10',
        },
    },
    {
        label: 'Produto por tag',
        patch: {
            name: 'Busca por tag',
            pattern: 'carregador, capa, pelicula',
            match_type: 'any_keyword',
            reply_type: 'product_by_tag',
            reply_text: '',
            priority: '5',
        },
    },
    {
        label: 'Busca livre',
        patch: {
            name: 'Busca por texto',
            pattern: 'tem, quero, procura',
            match_type: 'any_keyword',
            reply_type: 'product_search',
            reply_search_query: '',
            priority: '3',
        },
    },
];

function formatNumber(value: unknown): string {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString('pt-BR') : '0';
}

function formatUsd(value: unknown): string {
    const number = Number(value || 0);
    return Number.isFinite(number)
        ? new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(number)
        : 'US$ 0,00';
}

function getStoreStatusLabel(storeStatus: AutoResponderStoreStatus | null): string {
    const status = String(storeStatus?.status || '');
    return statusLabels[status] || status || 'Sem dados';
}

function parseTagIds(value: AutoResponderRule['tag_ids']): number[] {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (!value) return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
        return [];
    }
}

function ruleToForm(rule: AutoResponderRule): RuleFormState {
    return {
        name: rule.name || '',
        pattern: rule.pattern || '',
        match_type: rule.match_type || 'any_keyword',
        reply_type: rule.reply_type || 'text',
        reply_text: rule.reply_text || '',
        reply_tag_id: rule.reply_tag_id == null ? '' : String(rule.reply_tag_id),
        reply_search_query: rule.reply_search_query || '',
        attachment_url: rule.attachment_url || '',
        attachment_caption: rule.attachment_caption || '',
        priority: String(rule.priority || 0),
        active: isEnabled(rule.active),
        tag_ids: parseTagIds(rule.tag_ids),
    };
}

function ruleFormToInput(form: RuleFormState): AutoResponderRuleInput {
    return {
        name: form.name.trim(),
        pattern: form.pattern.trim(),
        match_type: form.match_type,
        reply_type: form.reply_type,
        reply_text: form.reply_text,
        reply_tag_id: form.reply_tag_id ? Number(form.reply_tag_id) : null,
        reply_search_query: form.reply_search_query.trim() || null,
        attachment_url: form.attachment_url.trim() || null,
        attachment_caption: form.attachment_caption.trim() || null,
        auto_apply_tag_id: null,
        tag_ids: form.tag_ids,
        priority: Number(form.priority || 0),
        active: form.active,
    };
}

function getTagName(tags: AutoResponderTag[], id: number): string {
    return tags.find((tag) => Number(tag.id) === Number(id))?.name || `Tag ${id}`;
}

function isConversationPaused(conversation: AutoResponderConversation): boolean {
    if (!conversation.paused_until) return false;
    return new Date(conversation.paused_until).getTime() > Date.now();
}

function formatDateTime(value?: string | null): string {
    if (!value) return 'Sem data';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function tagScopesIncludes(tag: AutoResponderTag, scope: string): boolean {
    if (Array.isArray(tag.scopes)) return tag.scopes.includes(scope);
    return String(tag.scopes || '').split(',').map((item) => item.trim()).includes(scope);
}

function tagToForm(tag: AutoResponderTag): TagFormState {
    const scopes = Array.isArray(tag.scopes)
        ? tag.scopes.map(String)
        : String(tag.scopes || '').split(',').map((item) => item.trim()).filter(Boolean);
    return {
        name: tag.name || '',
        color: tag.color || '#2563eb',
        description: tag.description || '',
        scopes: scopes.length ? scopes : ['conversation'],
        show_on_bot: isEnabled(tag.show_on_bot),
    };
}

function tagFormToInput(form: TagFormState): AutoResponderTagInput {
    return {
        name: form.name.trim(),
        color: form.color || '#2563eb',
        description: form.description.trim() || null,
        scopes: form.scopes,
        show_on_bot: form.show_on_bot,
    };
}

function aiTrainingFormToInput(form: AiTrainingFormState): AutoResponderAiTrainingInput {
    return {
        title: form.title.trim(),
        training_type: form.training_type,
        content: form.content.trim(),
        priority: Number(form.priority || 0),
        active: form.active,
    };
}

function parseConversationFlowKeywordMap(value: AutoResponderSettings['conversation_flow_keywords']): Record<string, string> {
    const defaults = emptySettingsForm.conversation_flow_keywords;
    if (!value) return { ...defaults };
    let parsed: unknown = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch {
            return { ...defaults };
        }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return { ...defaults };
    const next = { ...defaults };
    Object.entries(parsed as Record<string, unknown>).forEach(([key, rawValue]) => {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        const joined = values.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
        if (joined) next[key] = joined;
    });
    return next;
}

function parseConversationFlowMessageMap(value: AutoResponderSettings['conversation_flow_messages']): Record<string, string> {
    const defaults = emptySettingsForm.conversation_flow_messages;
    if (!value) return { ...defaults };
    let parsed: unknown = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch {
            return { ...defaults };
        }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return { ...defaults };
    const next = { ...defaults };
    Object.entries(parsed as Record<string, unknown>).forEach(([key, rawValue]) => {
        if (Object.prototype.hasOwnProperty.call(next, key)) {
            next[key] = String(rawValue ?? '').trim();
        }
    });
    return next;
}

function conversationFlowKeywordsToInput(map: Record<string, string>): Record<string, string[]> {
    return Object.fromEntries(
        Object.entries(map).map(([key, value]) => [
            key,
            String(value || '')
                .split(',')
                .map((keyword) => keyword.trim())
                .filter(Boolean),
        ])
    );
}

function conversationFlowMessagesToInput(map: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(map).map(([key, value]) => [key, String(value || '').trim()])
    );
}

function settingsToForm(settings: AutoResponderSettings | null): SettingsFormState {
    if (!settings) return emptySettingsForm;
    return {
        enabled: isEnabled(settings.enabled),
        human_message_in_hours: settings.human_message_in_hours || '',
        human_message_out_of_hours: settings.human_message_out_of_hours || '',
        human_pause_minutes: String(settings.human_pause_minutes ?? 60),
        greeting_prefix: settings.greeting_prefix || '',
        fallback_message: settings.fallback_message || '',
        signature_enabled: settings.signature_enabled === undefined ? true : isEnabled(settings.signature_enabled),
        signature_message: settings.signature_message || 'Pitoco, assistente virtual do Mercado do Vale. Se precisar de ajuda personalizada, nossa equipe continua o atendimento por aqui.',
        auto_pause_fallback_threshold: String(settings.auto_pause_fallback_threshold ?? 3),
        auto_pause_fallback_minutes: String(settings.auto_pause_fallback_minutes ?? 30),
        auto_pause_fallback_message: settings.auto_pause_fallback_message || '',
        max_replies_per_conversation: String(settings.max_replies_per_conversation ?? 20),
        max_replies_window_hours: String(settings.max_replies_window_hours ?? 24),
        send_product_images: isEnabled(settings.send_product_images),
        max_images_per_response: String(settings.max_images_per_response ?? 1),
        use_numbered_lists: isEnabled(settings.use_numbered_lists),
        numbered_list_threshold: String(settings.numbered_list_threshold ?? 2),
        numbered_list_validity_minutes: String(settings.numbered_list_validity_minutes ?? 30),
        conversation_flow_keywords: parseConversationFlowKeywordMap(settings.conversation_flow_keywords),
        conversation_flow_messages: parseConversationFlowMessageMap(settings.conversation_flow_messages),
        ai_enabled: isEnabled(settings.ai_enabled),
        ai_model: settings.ai_model || 'gpt-5-nano',
        ai_daily_limit: String(settings.ai_daily_limit ?? 0),
        ai_monthly_limit: String(settings.ai_monthly_limit ?? 0),
        ai_credit_balance_usd: String(settings.ai_credit_balance_usd ?? 0),
        ai_credit_alert_usd: String(settings.ai_credit_alert_usd ?? 5),
        ai_input_cost_per_1m_usd: String(settings.ai_input_cost_per_1m_usd ?? 0),
        ai_output_cost_per_1m_usd: String(settings.ai_output_cost_per_1m_usd ?? 0),
        openai_api_key: '',
        openai_api_key_masked: settings.openai_api_key_masked || '',
        has_openai_api_key: isEnabled(settings.has_openai_api_key),
        openai_admin_api_key: '',
        openai_admin_api_key_masked: settings.openai_admin_api_key_masked || '',
        has_openai_admin_api_key: isEnabled(settings.has_openai_admin_api_key),
        archive_to_synology: isEnabled(settings.archive_to_synology),
        archive_after_days: String(settings.archive_after_days ?? 7),
    };
}

function settingsFormToInput(
    form: SettingsFormState,
    settingsKeywordRows: TagKeywordRow[]
): Partial<AutoResponderSettings> {
    const input: Partial<AutoResponderSettings> = {
        enabled: form.enabled,
        human_message_in_hours: form.human_message_in_hours,
        human_message_out_of_hours: form.human_message_out_of_hours,
        human_pause_minutes: Number(form.human_pause_minutes || 0),
        greeting_prefix: form.greeting_prefix,
        fallback_message: form.fallback_message,
        signature_enabled: form.signature_enabled,
        signature_message: form.signature_message,
        auto_pause_fallback_threshold: Number(form.auto_pause_fallback_threshold || 0),
        auto_pause_fallback_minutes: Number(form.auto_pause_fallback_minutes || 0),
        auto_pause_fallback_message: form.auto_pause_fallback_message,
        max_replies_per_conversation: Number(form.max_replies_per_conversation || 0),
        max_replies_window_hours: Number(form.max_replies_window_hours || 0),
        send_product_images: form.send_product_images,
        max_images_per_response: Number(form.max_images_per_response || 0),
        use_numbered_lists: form.use_numbered_lists,
        numbered_list_threshold: Number(form.numbered_list_threshold || 0),
        numbered_list_validity_minutes: Number(form.numbered_list_validity_minutes || 0),
        conversation_flow_keywords: conversationFlowKeywordsToInput(form.conversation_flow_keywords),
        conversation_flow_messages: conversationFlowMessagesToInput(form.conversation_flow_messages),
        ai_enabled: form.ai_enabled,
        ai_model: form.ai_model || 'gpt-5-nano',
        ai_daily_limit: Number(form.ai_daily_limit || 0),
        ai_monthly_limit: Number(form.ai_monthly_limit || 0),
        ai_credit_balance_usd: Number(form.ai_credit_balance_usd || 0),
        ai_credit_alert_usd: Number(form.ai_credit_alert_usd || 0),
        ai_input_cost_per_1m_usd: Number(form.ai_input_cost_per_1m_usd || 0),
        ai_output_cost_per_1m_usd: Number(form.ai_output_cost_per_1m_usd || 0),
        product_tag_keywords: keywordRowsToMap(settingsKeywordRows),
        archive_to_synology: form.archive_to_synology,
        archive_after_days: Number(form.archive_after_days || 0),
    };
    if (form.openai_api_key.trim()) {
        input.openai_api_key = form.openai_api_key.trim();
    }
    if (form.openai_admin_api_key.trim()) {
        input.openai_admin_api_key = form.openai_admin_api_key.trim();
    }
    return input;
}

function createTagKeywordRow(patch: Partial<TagKeywordRow> = {}): TagKeywordRow {
    return {
        id: `keyword-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tagId: '',
        keywords: '',
        ...patch,
    };
}

function parseSettingsKeywordRows(value: AutoResponderSettings['product_tag_keywords']): TagKeywordRow[] {
    if (!value) return [];
    let parsed: unknown = value;
    if (typeof value === 'string') {
        try {
            parsed = JSON.parse(value);
        } catch {
            return [];
        }
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return [];

    return Object.entries(parsed as Record<string, unknown>)
        .map(([key, rawValue], index) => {
            const rawValues = Array.isArray(rawValue) ? rawValue : [rawValue];
            const values = rawValues
                .map((item) => String(item ?? '').trim())
                .filter(Boolean);

            if (/^\d+$/.test(key)) {
                return createTagKeywordRow({
                    id: `keyword-${key}-${index}`,
                    tagId: key,
                    keywords: values.join(', '),
                });
            }

            return createTagKeywordRow({
                id: `keyword-${key}-${index}`,
                tagId: values[0] || '',
                keywords: key,
            });
        })
        .filter((row) => row.tagId || row.keywords);
}

function keywordRowsToMap(rows: TagKeywordRow[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    rows.forEach((row) => {
        const tagId = row.tagId.trim();
        const keywords = row.keywords
            .split(',')
            .map((keyword) => keyword.trim())
            .filter(Boolean);
        if (!tagId || keywords.length === 0) return;
        map[tagId] = Array.from(new Set([...(map[tagId] || []), ...keywords]));
    });
    return map;
}

function blockFormToInput(form: BlockFormState): AutoResponderBlocklistInput {
    return {
        pattern: form.pattern.trim(),
        pattern_type: form.pattern_type,
        contact_name: form.contact_name.trim() || null,
        reason: form.reason.trim() || null,
        active: form.active,
    };
}

function blockEntryToForm(entry: AutoResponderBlocklistEntry): BlockFormState {
    return {
        pattern: entry.pattern || '',
        pattern_type: entry.pattern_type || 'exact',
        contact_name: entry.contact_name || '',
        reason: entry.reason || '',
        active: isEnabled(entry.active),
    };
}

const MetricTile: React.FC<{
    label: string;
    value: string;
    tone?: 'blue' | 'emerald' | 'amber' | 'slate';
    icon: React.ReactNode;
}> = ({ label, value, tone = 'slate', icon }) => {
    const tones = {
        blue: 'border-blue-100 bg-blue-50 text-blue-700',
        emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        amber: 'border-amber-100 bg-amber-50 text-amber-700',
        slate: 'border-slate-200 bg-white text-slate-700',
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                </div>
                <div className={`rounded-lg border p-2 ${tones[tone]}`}>{icon}</div>
            </div>
        </div>
    );
};

const EmptyPanel: React.FC<{ title: string; marker: string }> = ({ title, marker }) => (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
        <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                <MessageCircle size={18} />
            </div>
            <div>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-500">{marker}</p>
            </div>
        </div>
    </div>
);

const RuleEditorModal: React.FC<{
    editingRule: AutoResponderRule | null;
    ruleForm: RuleFormState;
    tags: AutoResponderTag[];
    isSaving: boolean;
    isUploadingAttachment: boolean;
    onChange: (patch: Partial<RuleFormState>) => void;
    onToggleTag: (tagId: number) => void;
    onUploadAttachment: (file: File | null) => void;
    onRemoveAttachment: () => void;
    onClose: () => void;
    onSave: () => void;
}> = ({
    editingRule,
    ruleForm,
    tags,
    isSaving,
    isUploadingAttachment,
    onChange,
    onToggleTag,
    onUploadAttachment,
    onRemoveAttachment,
    onClose,
    onSave,
}) => (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
        <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        {editingRule ? 'Editar resposta' : 'Nova resposta'}
                    </h2>
                    <p className="text-sm text-slate-500">Configure o gatilho e a resposta enviada pelo bot.</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Fechar"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-5 px-5 py-5">
                <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Aplicar template</label>
                    <div className="flex flex-wrap gap-2">
                        {ruleTemplates.map((template) => (
                            <button
                                key={template.label}
                                type="button"
                                onClick={() => onChange(template.patch)}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                {template.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Nome</span>
                        <input
                            value={ruleForm.name}
                            onChange={(event) => onChange({ name: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Prioridade</span>
                        <input
                            type="number"
                            value={ruleForm.priority}
                            onChange={(event) => onChange({ priority: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block md:col-span-2">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Palavras-chave</span>
                        <textarea
                            value={ruleForm.pattern}
                            onChange={(event) => onChange({ pattern: event.target.value })}
                            rows={3}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de match</span>
                        <select
                            value={ruleForm.match_type}
                            onChange={(event) => onChange({ match_type: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="any_keyword">Qualquer palavra</option>
                            <option value="all_keywords">Todas as palavras</option>
                            <option value="contains">Contém texto</option>
                            <option value="exact">Exata</option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de resposta</span>
                        <select
                            value={ruleForm.reply_type}
                            onChange={(event) => onChange({ reply_type: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="text">Texto</option>
                            <option value="product_by_tag">Produtos por tag</option>
                            <option value="product_search">Busca de produto</option>
                        </select>
                    </label>

                    {ruleForm.reply_type === 'product_by_tag' && (
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Tag de produto</span>
                            <select
                                value={ruleForm.reply_tag_id}
                                onChange={(event) => onChange({ reply_tag_id: event.target.value })}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Selecione</option>
                                {tags.map((tag) => (
                                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                                ))}
                            </select>
                        </label>
                    )}

                    {ruleForm.reply_type === 'product_search' && (
                        <label className="block">
                            <span className="mb-1 block text-sm font-semibold text-slate-700">Busca fixa</span>
                            <input
                                value={ruleForm.reply_search_query}
                                onChange={(event) => onChange({ reply_search_query: event.target.value })}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    )}

                </div>

                <div>
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Tags da regra</span>
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                            const selected = ruleForm.tag_ids.includes(Number(tag.id));
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => onToggleTag(Number(tag.id))}
                                    className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                                        selected
                                            ? 'border-blue-200 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    {selected && <CheckCircle2 size={14} className="mr-1 inline" />}
                                    {tag.name}
                                </button>
                            );
                        })}
                        {tags.length === 0 && <span className="text-sm text-slate-500">Nenhuma tag cadastrada.</span>}
                    </div>
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Texto da resposta</span>
                    <textarea
                        value={ruleForm.reply_text}
                        onChange={(event) => onChange({ reply_text: event.target.value })}
                        rows={5}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <div className="rounded-lg border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <span className="block text-sm font-semibold text-slate-700">Imagem da resposta</span>
                            {ruleForm.attachment_url && (
                                <span className="mt-1 block text-xs font-semibold text-emerald-700">Anexo enviado</span>
                            )}
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100">
                            {isUploadingAttachment ? 'Enviando...' : 'Enviar imagem'}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploadingAttachment}
                                onChange={(event) => {
                                    onUploadAttachment(event.target.files?.[0] || null);
                                    event.currentTarget.value = '';
                                }}
                            />
                        </label>
                    </div>
                    {ruleForm.attachment_url && (
                        <div className="mt-4 space-y-3">
                            <input
                                value={ruleForm.attachment_url}
                                readOnly
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 outline-none"
                            />
                            <label className="block">
                                <span className="mb-1 block text-sm font-semibold text-slate-700">Legenda do anexo</span>
                                <input
                                    value={ruleForm.attachment_caption}
                                    onChange={(event) => onChange({ attachment_caption: event.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                            <button
                                type="button"
                                onClick={onRemoveAttachment}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                            >
                                Remover anexo
                            </button>
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Preview ao vivo</p>
                    <div className="max-w-lg rounded-lg bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
                        {ruleForm.reply_text || (ruleForm.reply_type === 'text' ? 'Digite o texto da resposta.' : 'O bot montará a lista de produtos automaticamente.')}
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !ruleForm.name.trim() || !ruleForm.pattern.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Save size={16} />
                    Salvar resposta
                </button>
            </div>
        </div>
    </div>
);

const BlocklistModal: React.FC<{
    editingBlocklistEntry: AutoResponderBlocklistEntry | null;
    blockForm: BlockFormState;
    isSaving: boolean;
    onChange: (patch: Partial<BlockFormState>) => void;
    onClose: () => void;
    onSave: () => void;
}> = ({ editingBlocklistEntry, blockForm, isSaving, onChange, onClose, onSave }) => (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                        {editingBlocklistEntry ? 'Editar bloqueio' : 'Adicionar bloqueio'}
                    </h2>
                    <p className="text-sm text-slate-500">Bloqueie um número, prefixo ou padrão.</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Fechar"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-4 px-5 py-5">
                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Padrão</span>
                    <input
                        value={blockForm.pattern}
                        onChange={(event) => onChange({ pattern: event.target.value })}
                        placeholder="Ex: 5587999999999"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo</span>
                        <select
                            value={blockForm.pattern_type}
                            onChange={(event) => onChange({ pattern_type: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="exact">Exato</option>
                            <option value="prefix">Prefixo</option>
                            <option value="regex">Regex</option>
                        </select>
                    </label>

                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Nome</span>
                        <input
                            value={blockForm.contact_name}
                            onChange={(event) => onChange({ contact_name: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Motivo</span>
                    <textarea
                        value={blockForm.reason}
                        onChange={(event) => onChange({ reason: event.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <input
                        type="checkbox"
                        checked={blockForm.active}
                        onChange={(event) => onChange({ active: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Bloqueio ativo</span>
                </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !blockForm.pattern.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Save size={16} />
                    Salvar bloqueio
                </button>
            </div>
        </div>
    </div>
);

const BulkBlocklistModal: React.FC<{
    bulkBlocklistText: string;
    isSaving: boolean;
    onChange: (value: string) => void;
    onClose: () => void;
    onSave: () => void;
}> = ({ bulkBlocklistText, isSaving, onChange, onClose, onSave }) => (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Importar em massa</h2>
                    <p className="text-sm text-slate-500">Cole um número ou padrão por linha.</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Fechar"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="px-5 py-5">
                <textarea
                    value={bulkBlocklistText}
                    onChange={(event) => onChange(event.target.value)}
                    rows={10}
                    placeholder={'5587999999999\n5587888\ncliente@example.com'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !bulkBlocklistText.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Save size={16} />
                    Importar bloqueados
                </button>
            </div>
        </div>
    </div>
);

const TagEditorModal: React.FC<{
    editingTag: AutoResponderTag | null;
    tagForm: TagFormState;
    isSaving: boolean;
    onChange: (patch: Partial<TagFormState>) => void;
    onToggleScope: (scope: string) => void;
    onClose: () => void;
    onSave: () => void;
}> = ({ editingTag, tagForm, isSaving, onChange, onToggleScope, onClose, onSave }) => (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4">
        <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">{editingTag ? 'Editar tag' : 'Nova tag'}</h2>
                    <p className="text-sm text-slate-500">Organize conversas, produtos e regras do bot.</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Fechar"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="space-y-4 px-5 py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px]">
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Nome</span>
                        <input
                            value={tagForm.name}
                            onChange={(event) => onChange({ name: event.target.value })}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Cor</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={tagForm.color}
                                onChange={(event) => onChange({ color: event.target.value })}
                                className="h-10 w-12 rounded-lg border border-slate-300 bg-white p-1"
                            />
                            <input
                                value={tagForm.color}
                                onChange={(event) => onChange({ color: event.target.value })}
                                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </label>
                </div>

                <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Descrição</span>
                    <textarea
                        value={tagForm.description}
                        onChange={(event) => onChange({ description: event.target.value })}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <div>
                    <span className="mb-2 block text-sm font-semibold text-slate-700">Escopo</span>
                    <div className="flex flex-wrap gap-2">
                        {tagScopeOptions.map((scope) => (
                            <label
                                key={scope.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                                <input
                                    type="checkbox"
                                    checked={tagForm.scopes.includes(scope.id)}
                                    onChange={() => onToggleScope(scope.id)}
                                    className="h-4 w-4 rounded border-slate-300"
                                />
                                {scope.label}
                            </label>
                        ))}
                    </div>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                    <input
                        type="checkbox"
                        checked={tagForm.show_on_bot}
                        onChange={(event) => onChange({ show_on_bot: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-700">Mostrar no bot</span>
                </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={onSave}
                    disabled={isSaving || !tagForm.name.trim() || tagForm.scopes.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Save size={16} />
                    Salvar tag
                </button>
            </div>
        </div>
    </div>
);

const AutoResponderPage: React.FC = () => {
    const [activeAutoResponderTab, setActiveAutoResponderTab] = React.useState(() => {
        if (typeof window === 'undefined') return 'respostas';
        return new URLSearchParams(window.location.search).get('aba') || 'respostas';
    });
    const [state, setState] = React.useState<LoadState>('idle');
    const [settings, setSettings] = React.useState<AutoResponderSettings | null>(null);
    const [stats, setStats] = React.useState<AutoResponderStats | null>(null);
    const [statsSource, setStatsSource] = React.useState<'mysql' | 'synology'>('mysql');
    const [statsFrom, setStatsFrom] = React.useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString().slice(0, 10);
    });
    const [storeStatus, setStoreStatus] = React.useState<AutoResponderStoreStatus | null>(null);
    const [rules, setRules] = React.useState<AutoResponderRule[]>([]);
    const [tags, setTags] = React.useState<AutoResponderTag[]>([]);
    const [categoryTags, setCategoryTags] = React.useState<AutoResponderCategoryTag[]>([]);
    const [conversations, setConversations] = React.useState<AutoResponderConversation[]>([]);
    const [blocklist, setBlocklist] = React.useState<AutoResponderBlocklistEntry[]>([]);
    const [unansweredQuestions, setUnansweredQuestions] = React.useState<AutoResponderUnansweredQuestion[]>([]);
    const [ruleStatusFilter, setRuleStatusFilter] = React.useState<RuleStatusFilter>('all');
    const [ruleTagFilter, setRuleTagFilter] = React.useState('');
    const [ruleSearch, setRuleSearch] = React.useState('');
    const [conversationStatusFilter, setConversationStatusFilter] = React.useState<ConversationStatusFilter>('all');
    const [conversationTagFilter, setConversationTagFilter] = React.useState('');
    const [conversationSearch, setConversationSearch] = React.useState('');
    const [conversationTagDrafts, setConversationTagDrafts] = React.useState<Record<string, number[]>>({});
    const [conversationActionSender, setConversationActionSender] = React.useState<string | null>(null);
    const [blocklistSearch, setBlocklistSearch] = React.useState('');
    const [blockForm, setBlockForm] = React.useState<BlockFormState>(emptyBlockForm);
    const [editingBlocklistEntry, setEditingBlocklistEntry] = React.useState<AutoResponderBlocklistEntry | null>(null);
    const [bulkBlocklistText, setBulkBlocklistText] = React.useState('');
    const [isBlockModalOpen, setIsBlockModalOpen] = React.useState(false);
    const [isBulkBlockModalOpen, setIsBulkBlockModalOpen] = React.useState(false);
    const [isSavingBlocklist, setIsSavingBlocklist] = React.useState(false);
    const [blocklistActionId, setBlocklistActionId] = React.useState<number | null>(null);
    const [curationSearch, setCurationSearch] = React.useState('');
    const [curationNotice, setCurationNotice] = React.useState<string | null>(null);
    const [curationActionQuestion, setCurationActionQuestion] = React.useState<string | null>(null);
    const [tagSearch, setTagSearch] = React.useState('');
    const [tagForm, setTagForm] = React.useState<TagFormState>(emptyTagForm);
    const [editingTag, setEditingTag] = React.useState<AutoResponderTag | null>(null);
    const [isTagModalOpen, setIsTagModalOpen] = React.useState(false);
    const [isSavingTag, setIsSavingTag] = React.useState(false);
    const [tagActionId, setTagActionId] = React.useState<number | null>(null);
    const [copiedCategoryTagPlaceholder, setCopiedCategoryTagPlaceholder] = React.useState<string | null>(null);
    const [editingRule, setEditingRule] = React.useState<AutoResponderRule | null>(null);
    const [isRuleModalOpen, setIsRuleModalOpen] = React.useState(false);
    const [isSavingRule, setIsSavingRule] = React.useState(false);
    const [deletingRuleId, setDeletingRuleId] = React.useState<number | null>(null);
    const [togglingRuleId, setTogglingRuleId] = React.useState<number | null>(null);
    const [isUploadingAttachment, setIsUploadingAttachment] = React.useState(false);
    const [ruleForm, setRuleForm] = React.useState<RuleFormState>(emptyRuleForm);
    const [settingsForm, setSettingsForm] = React.useState<SettingsFormState>(emptySettingsForm);
    const [settingsKeywordRows, setSettingsKeywordRows] = React.useState<TagKeywordRow[]>([]);
    const [isSavingSettings, setIsSavingSettings] = React.useState(false);
    const [settingsNotice, setSettingsNotice] = React.useState<string | null>(null);
    const [aiTrainingEntries, setAiTrainingEntries] = React.useState<AutoResponderAiTraining[]>([]);
    const [aiTrainingForm, setAiTrainingForm] = React.useState<AiTrainingFormState>(emptyAiTrainingForm);
    const [editingAiTraining, setEditingAiTraining] = React.useState<AutoResponderAiTraining | null>(null);
    const [isSavingAiTraining, setIsSavingAiTraining] = React.useState(false);
    const [aiTrainingNotice, setAiTrainingNotice] = React.useState<string | null>(null);
    const [testMessage, setTestMessage] = React.useState('Oi, tem iPhone?');
    const [testSender, setTestSender] = React.useState('teste-bot');
    const [testContactFirstName, setTestContactFirstName] = React.useState('Cliente');
    const [testResult, setTestResult] = React.useState<AutoResponderTestReplyResult | null>(null);
    const [testFlowMessages, setTestFlowMessages] = React.useState('redmi note 15\n1\ncomprar\n1\nfinalizar\nretirada');
    const [testFlowResult, setTestFlowResult] = React.useState<AutoResponderTestFlowResult | null>(null);
    const [editableTestReplies, setEditableTestReplies] = React.useState<string[]>([]);
    const [isTestingReply, setIsTestingReply] = React.useState(false);
    const [isTestingFlow, setIsTestingFlow] = React.useState(false);
    const [savingTestReplyIndex, setSavingTestReplyIndex] = React.useState<number | null>(null);
    const [testNotice, setTestNotice] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const loadDashboard = React.useCallback(async () => {
        setState('loading');
        setError(null);
        try {
            const [
                settingsData,
                statsData,
                storeStatusData,
                rulesData,
                tagsData,
                categoryTagsData,
                conversationsData,
                blocklistData,
                unansweredData,
                aiTrainingData,
            ] = await Promise.all([
                autoResponderService.getSettings(),
                autoResponderService.getStats({
                    source: statsSource,
                    from: statsSource === 'synology' ? statsFrom : undefined,
                }),
                autoResponderService.getStoreStatus(),
                autoResponderService.listRules(),
                autoResponderService.listTags(),
                autoResponderService.listCategoryTags(),
                autoResponderService.listConversations({ limit: 100 }),
                autoResponderService.listBlocklist(),
                autoResponderService.listUnanswered({ limit: 100 }),
                autoResponderService.listAiTraining(),
            ]);
            setSettings(settingsData);
            setSettingsForm(settingsToForm(settingsData));
            setSettingsKeywordRows(parseSettingsKeywordRows(settingsData?.product_tag_keywords));
            setStats(statsData);
            setStoreStatus(storeStatusData);
            setRules(rulesData);
            setTags(tagsData);
            setCategoryTags(categoryTagsData);
            setConversations(conversationsData);
            setBlocklist(blocklistData);
            setUnansweredQuestions(unansweredData);
            setAiTrainingEntries(aiTrainingData);
            setConversationTagDrafts((current) => {
                const next = { ...current };
                conversationsData.forEach((conversation) => {
                    if (!next[conversation.sender]) {
                        next[conversation.sender] = parseTagIds(conversation.tag_ids);
                    }
                });
                return next;
            });
            setState('ready');
        } catch (err) {
            console.error('[AutoResponderPage] load error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao carregar atendimento automático');
            setState('error');
        }
    }, [statsFrom, statsSource]);

    React.useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const summary = stats?.summary || {};
    const aiFinance = stats?.summary?.ai_finance;
    const aiOfficialRemainingCredit = aiFinance?.openai_official_remaining_credit_usd;
    const aiDisplayedRemainingCredit = aiOfficialRemainingCredit ?? aiFinance?.remaining_credit_usd;
    const aiCreditAlertUsd = Number(settingsForm.ai_credit_alert_usd || aiFinance?.credit_alert_usd || 0);
    const aiFinanceNeedsAttention = aiDisplayedRemainingCredit != null
        && Number(aiDisplayedRemainingCredit) <= aiCreditAlertUsd;
    const aiHasAdminKey = settingsForm.has_openai_admin_api_key || isEnabled(aiFinance?.has_openai_admin_api_key);
    const enabled = isEnabled(settings?.enabled);
    const loading = state === 'loading' || state === 'idle';
    const conversationTags = React.useMemo(
        () => tags.filter((tag) => tagScopesIncludes(tag, 'conversation')),
        [tags]
    );
    const productTags = React.useMemo(
        () => tags.filter((tag) => tagScopesIncludes(tag, 'product')),
        [tags]
    );
    const filteredRules = React.useMemo(() => {
        const search = ruleSearch.trim().toLowerCase();
        return rules.filter((rule) => {
            if (ruleStatusFilter === 'active' && !isEnabled(rule.active)) return false;
            if (ruleStatusFilter === 'inactive' && isEnabled(rule.active)) return false;
            if (ruleTagFilter && !parseTagIds(rule.tag_ids).includes(Number(ruleTagFilter))) return false;
            if (!search) return true;
            return [rule.name, rule.pattern, rule.reply_text, rule.reply_search_query]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search));
        });
    }, [rules, ruleSearch, ruleStatusFilter, ruleTagFilter]);
    const filteredConversations = React.useMemo(() => {
        const search = conversationSearch.trim().toLowerCase();
        return conversations.filter((conversation) => {
            const paused = isConversationPaused(conversation);
            if (conversationStatusFilter === 'active' && paused) return false;
            if (conversationStatusFilter === 'paused' && !paused) return false;
            if (conversationTagFilter && !parseTagIds(conversation.tag_ids).includes(Number(conversationTagFilter))) return false;
            if (!search) return true;
            return [conversation.sender, conversation.contact_name, conversation.last_message, conversation.pause_reason]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search));
        });
    }, [conversations, conversationSearch, conversationStatusFilter, conversationTagFilter]);
    const filteredBlocklist = React.useMemo(() => {
        const search = blocklistSearch.trim().toLowerCase();
        if (!search) return blocklist;
        return blocklist.filter((entry) =>
            [entry.pattern, entry.pattern_type, entry.contact_name, entry.reason]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search))
        );
    }, [blocklist, blocklistSearch]);
    const filteredUnansweredQuestions = React.useMemo(() => {
        const search = curationSearch.trim().toLowerCase();
        if (!search) return unansweredQuestions;
        return unansweredQuestions.filter((item) => item.question.toLowerCase().includes(search));
    }, [unansweredQuestions, curationSearch]);
    const filteredTags = React.useMemo(() => {
        const search = tagSearch.trim().toLowerCase();
        if (!search) return tags;
        return tags.filter((tag) =>
            [tag.name, tag.description, tag.color, tag.scopes]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search))
        );
    }, [tags, tagSearch]);
    const filteredCategoryTags = React.useMemo(() => {
        const search = tagSearch.trim().toLowerCase();
        if (!search) return categoryTags;
        return categoryTags.filter((category) =>
            [category.name, category.slug, category.parent_id]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search))
        );
    }, [categoryTags, tagSearch]);
    const greetingCategoryPreviewCategories = React.useMemo(
        () => categoryTags.filter((category) => isEnabled(category.appears_on_greeting)),
        [categoryTags]
    );
    const greetingCategoryPreviewText = React.useMemo(() => {
        if (greetingCategoryPreviewCategories.length === 0) {
            return 'Nenhuma categoria com estoque ativo para mostrar na saudacao automatica.';
        }

        return [
            'Ola!',
            '',
            'Categorias disponiveis:',
            ...greetingCategoryPreviewCategories.map((category, index) => `${index + 1}. ${category.name}`),
            '',
            'Responda com o numero ou nome da categoria.',
        ].join('\n');
    }, [greetingCategoryPreviewCategories]);
    const hiddenAutoResponderMessageSamples = React.useMemo(() => [
        {
            title: 'Produto escolhido',
            source: 'Fluxo de compra',
            text: [
                'Certo, voce escolheu:',
                'Capa Anti Impacto Redmi Note 14',
                'Valor: R$ 39,90',
                '',
                'Quer comprar esse produto ou ver detalhes primeiro?',
                'Responda "comprar" ou "detalhes".',
            ].join('\n'),
        },
        {
            title: 'Pergunta de quantidade',
            source: 'Fluxo de compra',
            text: [
                'Quantas unidades voce quer adicionar ao carrinho?',
                'Estoque disponivel: 5 unidade(s).',
                'Responda apenas com o numero.',
            ].join('\n'),
        },
        {
            title: 'Sem estoque',
            source: 'Estoque',
            text: [
                'Esse produto esta sem estoque no momento:',
                'Capa Anti Impacto Redmi Note 14',
                '',
                'Posso procurar uma opcao parecida para voce.',
            ].join('\n'),
        },
        {
            title: 'Estoque insuficiente',
            source: 'Estoque',
            text: [
                'Temos apenas 2 unidade(s) disponiveis desse produto.',
                'Responda com uma quantidade menor para continuar.',
            ].join('\n'),
        },
        {
            title: 'Item adicionado',
            source: 'Carrinho',
            text: [
                'Adicionei ao seu pedido:',
                '2x Capa Anti Impacto Redmi Note 14',
                'Subtotal: R$ 79,80',
            ].join('\n'),
        },
        {
            title: 'Adicionar mais produtos',
            source: 'Carrinho',
            text: [
                'Deseja adicionar mais algum produto?',
                'Responda "sim" para continuar comprando ou "finalizar" para concluir o pedido.',
            ].join('\n'),
        },
        {
            title: 'Carrinho cancelado',
            source: 'Carrinho',
            text: 'Tudo certo, cancelei o pedido em andamento. Se precisar, e so chamar.',
        },
        {
            title: 'Item removido',
            source: 'Carrinho',
            text: 'Removi esse item do seu pedido. Quer ver o resumo atualizado?',
        },
        {
            title: 'Resumo do pedido',
            source: 'Fechamento',
            text: [
                'Resumo do pedido:',
                '1. 2x Capa Anti Impacto Redmi Note 14 - R$ 79,80',
                '',
                'Total: R$ 79,80',
                'Como deseja receber: retirada ou entrega?',
            ].join('\n'),
        },
        {
            title: 'Retirada na loja',
            source: 'Fechamento',
            text: [
                'Combinado, seu pedido ficara para retirada na loja.',
                'Vamos confirmar seus dados para separar tudo certinho.',
            ].join('\n'),
        },
        {
            title: 'Entrega',
            source: 'Fechamento',
            text: [
                'Me envie o endereco completo para entrega:',
                'Rua, numero, bairro, cidade e ponto de referencia se tiver.',
            ].join('\n'),
        },
        {
            title: 'Endereco anotado',
            source: 'Fechamento',
            text: 'Endereco anotado. Agora vou confirmar seus dados para finalizar o pedido.',
        },
        {
            title: 'Confirmacao de dados',
            source: 'Cliente',
            text: [
                'Confira seus dados:',
                'Nome: Maria Silva',
                'Telefone: 559999999999',
                '',
                'Esta tudo correto? Responda "sim" ou envie a correcao.',
            ].join('\n'),
        },
        {
            title: 'CPF/CNPJ',
            source: 'Cliente',
            text: 'Para finalizar, envie seu CPF ou CNPJ. Pode mandar somente os numeros.',
        },
        {
            title: 'Produto indisponivel',
            source: 'Busca de produtos',
            text: [
                'Nao encontrei estoque ativo para esse produto agora.',
                'Posso te mostrar opcoes parecidas ou outras categorias.',
            ].join('\n'),
        },
        {
            title: 'Garantia precisa detalhe',
            source: 'Garantia',
            text: [
                'Para consultar garantia, me envie o produto ou modelo que deseja verificar.',
                'Exemplo: garantia capa iPhone 13.',
            ].join('\n'),
        },
    ], []);
    const totalMessages = Number(summary.total_messages || 0);
    const fallbackMessages = Number(summary.fallback_messages || 0);
    const productMessages = Number(summary.product_messages || 0);
    const humanRequests = Number(summary.human_requests || 0);
    const responseRate = totalMessages > 0
        ? Math.max(0, Math.round(((totalMessages - fallbackMessages) / totalMessages) * 100))
        : 0;
    const maxIntentTotal = Math.max(...(stats?.byIntent || []).map((item) => Number(item.total || 0)), 1);

    const copyCategoryTagPlaceholder = React.useCallback(async (placeholder: string) => {
        try {
            await navigator.clipboard.writeText(placeholder);
            setCopiedCategoryTagPlaceholder(placeholder);
            window.setTimeout(() => {
                setCopiedCategoryTagPlaceholder((current) => current === placeholder ? null : current);
            }, 1800);
        } catch (err) {
            console.error('[AutoResponderPage] copy tag placeholder error:', err);
            setError('Nao foi possivel copiar a tag automaticamente.');
        }
    }, []);

    const reloadConversations = React.useCallback(async () => {
        const data = await autoResponderService.listConversations({ limit: 100 });
        setConversations(data);
        setConversationTagDrafts((current) => {
            const next = { ...current };
            data.forEach((conversation) => {
                next[conversation.sender] = parseTagIds(conversation.tag_ids);
            });
            return next;
        });
    }, []);

    React.useEffect(() => {
        if (activeAutoResponderTab !== 'conversas' || state !== 'ready') return;
        const conversationPollingInterval = window.setInterval(() => {
            void reloadConversations();
        }, 5000);
        return () => window.clearInterval(conversationPollingInterval);
    }, [activeAutoResponderTab, state, reloadConversations]);

    const reloadBlocklist = async () => {
        const data = await autoResponderService.listBlocklist();
        setBlocklist(data);
    };

    const reloadUnansweredQuestions = async () => {
        const data = await autoResponderService.listUnanswered({ limit: 100 });
        setUnansweredQuestions(data);
    };

    const reloadTags = async () => {
        const [data, dynamicCategories] = await Promise.all([
            autoResponderService.listTags(),
            autoResponderService.listCategoryTags(),
        ]);
        setTags(data);
        setCategoryTags(dynamicCategories);
    };

    const openNewRule = () => {
        setEditingRule(null);
        setRuleForm(emptyRuleForm);
        setIsRuleModalOpen(true);
    };

    const openEditRule = (rule: AutoResponderRule) => {
        setEditingRule(rule);
        setRuleForm(ruleToForm(rule));
        setIsRuleModalOpen(true);
    };

    const updateRuleForm = (patch: Partial<RuleFormState>) => {
        setRuleForm((current) => ({ ...current, ...patch }));
    };

    const toggleRuleTag = (tagId: number) => {
        setRuleForm((current) => ({
            ...current,
            tag_ids: current.tag_ids.includes(tagId)
                ? current.tag_ids.filter((id) => id !== tagId)
                : [...current.tag_ids, tagId],
        }));
    };

    const uploadRuleAttachment = async (file: File | null) => {
        if (!file) return;
        setIsUploadingAttachment(true);
        setError(null);
        try {
            const uploaded = await autoResponderService.uploadAttachment(file);
            updateRuleForm({
                attachment_url: uploaded.url,
                attachment_caption: ruleForm.attachment_caption,
            });
        } catch (err) {
            console.error('[AutoResponderPage] upload attachment error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao enviar anexo');
        } finally {
            setIsUploadingAttachment(false);
        }
    };

    const saveRule = async () => {
        setIsSavingRule(true);
        setError(null);
        try {
            const payload = ruleFormToInput(ruleForm);
            if (editingRule) {
                await autoResponderService.updateRule(editingRule.id, payload);
            } else {
                await autoResponderService.createRule(payload);
            }
            const [rulesData, statsData] = await Promise.all([
                autoResponderService.listRules(),
                autoResponderService.getStats(),
            ]);
            setRules(rulesData);
            setStats(statsData);
            if (!editingRule) {
                setUnansweredQuestions((current) => current.filter((item) => item.question !== ruleForm.pattern));
            }
            setIsRuleModalOpen(false);
            setEditingRule(null);
            setRuleForm(emptyRuleForm);
        } catch (err) {
            console.error('[AutoResponderPage] save rule error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao salvar resposta automática');
        } finally {
            setIsSavingRule(false);
        }
    };

    const toggleRuleActive = async (rule: AutoResponderRule) => {
        setTogglingRuleId(rule.id);
        setError(null);
        try {
            await autoResponderService.updateRule(rule.id, { active: !isEnabled(rule.active) });
            const [rulesData, statsData] = await Promise.all([
                autoResponderService.listRules(),
                autoResponderService.getStats(),
            ]);
            setRules(rulesData);
            setStats(statsData);
        } catch (err) {
            console.error('[AutoResponderPage] toggle rule active error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao alterar status da resposta');
        } finally {
            setTogglingRuleId(null);
        }
    };

    const deleteRule = async (rule: AutoResponderRule) => {
        if (!window.confirm(`Excluir a resposta "${rule.name}"?`)) return;
        setDeletingRuleId(rule.id);
        setError(null);
        try {
            await autoResponderService.deleteRule(rule.id);
            const [rulesData, statsData] = await Promise.all([
                autoResponderService.listRules(),
                autoResponderService.getStats(),
            ]);
            setRules(rulesData);
            setStats(statsData);
        } catch (err) {
            console.error('[AutoResponderPage] delete rule error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao excluir resposta automática');
        } finally {
            setDeletingRuleId(null);
        }
    };

    const pauseConversation = async (sender: string, minutes: number) => {
        setConversationActionSender(sender);
        setError(null);
        try {
            await autoResponderService.pauseConversation(sender, minutes, 'admin');
            await reloadConversations();
        } catch (err) {
            console.error('[AutoResponderPage] pause conversation error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao pausar conversa');
        } finally {
            setConversationActionSender(null);
        }
    };

    const resumeConversation = async (sender: string) => {
        setConversationActionSender(sender);
        setError(null);
        try {
            await autoResponderService.resumeConversation(sender);
            await reloadConversations();
        } catch (err) {
            console.error('[AutoResponderPage] resume conversation error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao liberar conversa');
        } finally {
            setConversationActionSender(null);
        }
    };

    const resetConversationCounters = async (sender: string) => {
        setConversationActionSender(sender);
        setError(null);
        try {
            await autoResponderService.resetConversationCounters(sender);
            await reloadConversations();
        } catch (err) {
            console.error('[AutoResponderPage] reset conversation counters error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao reiniciar conversa');
        } finally {
            setConversationActionSender(null);
        }
    };

    const toggleConversationTagDraft = (sender: string, tagId: number) => {
        setConversationTagDrafts((current) => {
            const existing = current[sender] || [];
            return {
                ...current,
                [sender]: existing.includes(tagId)
                    ? existing.filter((id) => id !== tagId)
                    : [...existing, tagId],
            };
        });
    };

    const saveConversationTags = async (sender: string) => {
        setConversationActionSender(sender);
        setError(null);
        try {
            await autoResponderService.setConversationTags(sender, conversationTagDrafts[sender] || []);
            await reloadConversations();
        } catch (err) {
            console.error('[AutoResponderPage] save conversation tags error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao salvar tags da conversa');
        } finally {
            setConversationActionSender(null);
        }
    };

    const openBlockModal = () => {
        setEditingBlocklistEntry(null);
        setBlockForm(emptyBlockForm);
        setIsBlockModalOpen(true);
    };

    const openEditBlockModal = (entry: AutoResponderBlocklistEntry) => {
        setEditingBlocklistEntry(entry);
        setBlockForm(blockEntryToForm(entry));
        setIsBlockModalOpen(true);
    };

    const updateBlockForm = (patch: Partial<BlockFormState>) => {
        setBlockForm((current) => ({ ...current, ...patch }));
    };

    const saveBlocklistEntry = async () => {
        setIsSavingBlocklist(true);
        setError(null);
        try {
            const payload = blockFormToInput(blockForm);
            if (editingBlocklistEntry) {
                await autoResponderService.updateBlocklistEntry(editingBlocklistEntry.id, payload);
            } else {
                await autoResponderService.createBlocklistEntry(payload);
            }
            await reloadBlocklist();
            setBlockForm(emptyBlockForm);
            setEditingBlocklistEntry(null);
            setIsBlockModalOpen(false);
        } catch (err) {
            console.error('[AutoResponderPage] save blocklist error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao salvar bloqueio');
        } finally {
            setIsSavingBlocklist(false);
        }
    };

    const saveBulkBlocklist = async () => {
        setIsSavingBlocklist(true);
        setError(null);
        try {
            const items = bulkBlocklistText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean);
            await autoResponderService.bulkCreateBlocklist(items);
            await reloadBlocklist();
            setBulkBlocklistText('');
            setIsBulkBlockModalOpen(false);
        } catch (err) {
            console.error('[AutoResponderPage] bulk blocklist error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao importar bloqueados');
        } finally {
            setIsSavingBlocklist(false);
        }
    };

    const deleteBlocklistEntry = async (entry: AutoResponderBlocklistEntry) => {
        if (!window.confirm('Excluir este bloqueio?')) return;
        setBlocklistActionId(entry.id);
        setError(null);
        try {
            await autoResponderService.deleteBlocklistEntry(entry.id);
            await reloadBlocklist();
        } catch (err) {
            console.error('[AutoResponderPage] delete blocklist error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao excluir bloqueio');
        } finally {
            setBlocklistActionId(null);
        }
    };

    const openRuleModalFromUnansweredQuestion = (question: AutoResponderUnansweredQuestion) => {
        setCurationActionQuestion(question.question);
        setCurationNotice(null);
        setError(null);
        setEditingRule(null);
        setRuleForm({
            ...emptyRuleForm,
            name: `Curadoria: ${question.question.slice(0, 60)}`,
            pattern: question.question,
            match_type: 'exact',
            reply_type: 'text',
            active: false,
        });
        setIsRuleModalOpen(true);
        setCurationNotice('Revise e salve a resposta sugerida');
    };

    const ignoreUnansweredQuestion = (question: AutoResponderUnansweredQuestion) => {
        setUnansweredQuestions((current) => current.filter((item) => item.question !== question.question));
        setCurationNotice('Pergunta ignorada nesta sessão');
    };

    const openNewTag = () => {
        setEditingTag(null);
        setTagForm(emptyTagForm);
        setIsTagModalOpen(true);
    };

    const openEditTag = (tag: AutoResponderTag) => {
        setEditingTag(tag);
        setTagForm(tagToForm(tag));
        setIsTagModalOpen(true);
    };

    const updateTagForm = (patch: Partial<TagFormState>) => {
        setTagForm((current) => ({ ...current, ...patch }));
    };

    const toggleTagScope = (scope: string) => {
        setTagForm((current) => {
            const scopes = current.scopes.includes(scope)
                ? current.scopes.filter((item) => item !== scope)
                : [...current.scopes, scope];
            return { ...current, scopes };
        });
    };

    const saveTag = async () => {
        setIsSavingTag(true);
        setError(null);
        try {
            const payload = tagFormToInput(tagForm);
            if (editingTag) {
                await autoResponderService.updateTag(editingTag.id, payload);
            } else {
                await autoResponderService.createTag(payload);
            }
            await reloadTags();
            setIsTagModalOpen(false);
            setEditingTag(null);
            setTagForm(emptyTagForm);
        } catch (err) {
            console.error('[AutoResponderPage] save tag error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao salvar tag');
        } finally {
            setIsSavingTag(false);
        }
    };

    const deleteTag = async (tag: AutoResponderTag) => {
        if (!window.confirm('Excluir esta tag?')) return;
        setTagActionId(tag.id);
        setError(null);
        try {
            await autoResponderService.deleteTag(tag.id);
            await reloadTags();
        } catch (err) {
            console.error('[AutoResponderPage] delete tag error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao excluir tag');
        } finally {
            setTagActionId(null);
        }
    };

    const updateSettingsForm = (patch: Partial<SettingsFormState>) => {
        setSettingsForm((current) => ({ ...current, ...patch }));
    };

    const updateConversationFlowKeywords = (flowKey: string, keywords: string) => {
        setSettingsForm((current) => ({
            ...current,
            conversation_flow_keywords: {
                ...current.conversation_flow_keywords,
                [flowKey]: keywords,
            },
        }));
    };

    const updateConversationFlowMessage = (messageKey: string, message: string) => {
        setSettingsForm((current) => ({
            ...current,
            conversation_flow_messages: {
                ...current.conversation_flow_messages,
                [messageKey]: message,
            },
        }));
    };

    const addKeywordRow = () => {
        setSettingsKeywordRows((current) => [...current, createTagKeywordRow()]);
    };

    const updateKeywordRow = (rowId: string, patch: Partial<TagKeywordRow>) => {
        setSettingsKeywordRows((current) =>
            current.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
        );
    };

    const removeKeywordRow = (rowId: string) => {
        setSettingsKeywordRows((current) => current.filter((row) => row.id !== rowId));
    };

    const reloadAiTraining = async () => {
        setAiTrainingEntries(await autoResponderService.listAiTraining());
    };

    const openEditAiTraining = (entry: AutoResponderAiTraining) => {
        setEditingAiTraining(entry);
        setAiTrainingForm({
            title: entry.title || '',
            training_type: entry.training_type || 'store_instruction',
            content: entry.content || '',
            priority: String(entry.priority || 0),
            active: isEnabled(entry.active),
        });
        setAiTrainingNotice(null);
    };

    const handleSaveAiTraining = async () => {
        const input = aiTrainingFormToInput(aiTrainingForm);
        if (!input.title || !input.content) {
            setAiTrainingNotice('Informe titulo e conteudo do treinamento.');
            return;
        }
        setIsSavingAiTraining(true);
        setAiTrainingNotice(null);
        try {
            if (editingAiTraining) {
                await autoResponderService.updateAiTraining(editingAiTraining.id, input);
                setAiTrainingNotice('Treinamento atualizado.');
            } else {
                await autoResponderService.createAiTraining(input);
                setAiTrainingNotice('Treinamento criado.');
            }
            setAiTrainingForm(emptyAiTrainingForm);
            setEditingAiTraining(null);
            await reloadAiTraining();
        } catch (err) {
            console.error('[AutoResponderPage] save ai training error:', err);
            setAiTrainingNotice(err instanceof Error ? err.message : 'Nao foi possivel salvar o treinamento.');
        } finally {
            setIsSavingAiTraining(false);
        }
    };

    const handleDeleteAiTraining = async (entry: AutoResponderAiTraining) => {
        if (!window.confirm(`Excluir treinamento "${entry.title}"?`)) return;
        setIsSavingAiTraining(true);
        setAiTrainingNotice(null);
        try {
            await autoResponderService.deleteAiTraining(entry.id);
            if (editingAiTraining?.id === entry.id) {
                setEditingAiTraining(null);
                setAiTrainingForm(emptyAiTrainingForm);
            }
            await reloadAiTraining();
            setAiTrainingNotice('Treinamento excluido.');
        } catch (err) {
            console.error('[AutoResponderPage] delete ai training error:', err);
            setAiTrainingNotice(err instanceof Error ? err.message : 'Nao foi possivel excluir o treinamento.');
        } finally {
            setIsSavingAiTraining(false);
        }
    };

    const saveSettings = async () => {
        setIsSavingSettings(true);
        setSettingsNotice(null);
        setError(null);
        try {
            const saved = await autoResponderService.updateSettings(settingsFormToInput(settingsForm, settingsKeywordRows));
            setSettings(saved);
            setSettingsForm(settingsToForm(saved));
            setSettingsKeywordRows(parseSettingsKeywordRows(saved.product_tag_keywords));
            setSettingsNotice('Configurações salvas');
        } catch (err) {
            console.error('[AutoResponderPage] save settings error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao salvar configurações');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const testBotReply = async () => {
        if (!testMessage.trim()) return;
        setIsTestingReply(true);
        setTestNotice(null);
        setError(null);
        try {
            const result = await autoResponderService.testReply({
                message: testMessage.trim(),
                sender: testSender.trim() || 'teste-bot',
                contactFirstName: testContactFirstName.trim(),
            });
            setTestResult(result);
            setEditableTestReplies((result.replies || []).map((reply) => reply.message || ''));
        } catch (err) {
            console.error('[AutoResponderPage] test reply error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao testar resposta do bot');
        } finally {
            setIsTestingReply(false);
        }
    };

    const testBotFlow = async () => {
        const messages = testFlowMessages
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean);
        if (messages.length === 0) return;
        setIsTestingFlow(true);
        setTestNotice(null);
        setError(null);
        try {
            const result = await autoResponderService.testFlow({
                messages,
                sender: testSender.trim() || `teste-fluxo-${Date.now()}`,
                contactFirstName: testContactFirstName.trim(),
                cleanup: true,
            });
            setTestFlowResult(result);
            setTestNotice(result.ok ? 'Fluxo completo testado' : 'Fluxo completo retornou falha');
        } catch (err) {
            console.error('[AutoResponderPage] test flow error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao testar fluxo completo');
        } finally {
            setIsTestingFlow(false);
        }
    };

    const updateEditableTestReply = (index: number, value: string) => {
        setEditableTestReplies((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)));
    };

    const saveTestReply = async (index: number) => {
        const replyText = (editableTestReplies[index] || '').trim();
        if (!replyText || !testResult) return;
        setSavingTestReplyIndex(index);
        setTestNotice(null);
        setError(null);
        try {
            if (testResult.intent === 'rule_text' && testResult.matched_rule_id) {
                await autoResponderService.updateRule(testResult.matched_rule_id, { reply_text: replyText });
                setTestNotice('Resposta da regra atualizada');
            } else {
                await autoResponderService.createRule({
                    name: `Teste: ${testMessage.trim().slice(0, 60)}`,
                    pattern: testMessage.trim(),
                    match_type: 'exact',
                    reply_type: 'text',
                    reply_text: replyText,
                    priority: 20,
                    active: true,
                    tag_ids: [],
                });
                setTestNotice('Nova resposta criada a partir do teste');
            }
            const rulesData = await autoResponderService.listRules();
            setRules(rulesData);
        } catch (err) {
            console.error('[AutoResponderPage] save test reply error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao salvar resposta testada');
        } finally {
            setSavingTestReplyIndex(null);
        }
    };

    const blockConversation = async (conversation: AutoResponderConversation) => {
        setConversationActionSender(conversation.sender);
        setError(null);
        try {
            await autoResponderService.createBlocklistEntry({
                pattern: conversation.sender,
                pattern_type: 'exact',
                contact_name: conversation.contact_name || null,
                reason: 'Bloqueado pela aba Conversas',
                active: true,
            });
            await pauseConversation(conversation.sender, 60 * 24 * 365);
            await reloadConversations();
        } catch (err) {
            console.error('[AutoResponderPage] block conversation error:', err);
            setError(err instanceof Error ? err.message : 'Falha ao bloquear conversa');
        } finally {
            setConversationActionSender(null);
        }
    };

    const flowMessages = settingsForm.conversation_flow_messages;
    const conversationEditorSteps = [
        {
            id: 'greeting',
            title: 'Saudacao inicial',
            subtitle: 'Quando o cliente chama no WhatsApp',
            customerLabel: 'Cliente pode dizer',
            customerText: 'bom dia, boa tarde, boa noite, oi, ola',
            botLabel: 'Bot responde',
            messageKey: 'greeting_reply',
            rows: 3,
        },
        {
            id: 'phone-list',
            title: 'Lista de celulares',
            subtitle: 'Depois da saudacao inicial',
            customerLabel: 'Cliente pode responder',
            customerText: settingsForm.conversation_flow_keywords.phone_list_opt_in || '',
            customerEditable: true,
            botLabel: 'Bot pergunta antes',
            messageKey: 'phone_list_prompt',
            rows: 3,
        },
        {
            id: 'product-list',
            title: 'Resultado da lista',
            subtitle: 'Quando o cliente aceita receber celulares',
            customerLabel: 'Cliente disse',
            customerText: 'quero',
            botLabel: 'Bot responde',
            messageKey: 'phone_list_reply',
            rows: 2,
            helper: 'Os produtos reais entram abaixo dessa frase conforme o catalogo.',
        },
        {
            id: 'name',
            title: 'Confirmar nome',
            subtitle: 'Antes de finalizar atendimento ou pedido',
            customerLabel: 'Quando falta nome',
            customerText: 'cliente ainda sem nome salvo',
            botLabel: 'Bot pergunta',
            messageKey: 'name_prompt',
            rows: 2,
        },
        {
            id: 'product-choice',
            title: 'Escolher produto',
            subtitle: 'Depois de mostrar opcoes',
            customerLabel: 'Cliente pode dizer',
            customerText: '1, 2, Redmi, iPhone, Samsung',
            botLabel: 'Bot orienta',
            messageKey: 'product_choice_prompt',
            rows: 2,
        },
        {
            id: 'variation',
            title: 'Escolher variacao',
            subtitle: 'Antes da quantidade quando houver cores disponiveis',
            customerLabel: 'Cliente pode dizer',
            customerText: '1, azul, preto',
            botLabel: 'Bot pergunta',
            botText: 'Antes de seguir, escolha a cor/variacao disponivel:\n\n1. Azul - R$ 980,00\n2. Preto - R$ 980,00\n\nResponda com o numero ou com a cor desejada.',
            rows: 6,
        },
        {
            id: 'fulfillment',
            title: 'Retirada ou entrega',
            subtitle: 'Quando existe item escolhido',
            customerLabel: 'Cliente pode dizer',
            customerText: 'retirada, entrega, delivery, motoboy',
            botLabel: 'Bot pergunta',
            messageKey: 'fulfillment_prompt',
            rows: 2,
        },
        {
            id: 'delivery',
            title: 'Endereco de entrega',
            subtitle: 'Quando o cliente escolhe entrega',
            customerLabel: 'Cliente escolheu',
            customerText: 'entrega',
            botLabel: 'Bot pergunta',
            messageKey: 'delivery_cep_prompt',
            rows: 2,
        },
        {
            id: 'delivery-cep-input',
            title: 'CEP da entrega',
            subtitle: 'Cliente pode mandar com ponto, traco ou texto',
            customerLabel: 'Cliente informa CEP',
            customerText: '56.304-000, 56304000',
            botLabel: 'Bot busca',
            botText: 'O sistema le somente os numeros, consulta BrasilAPI e prepara o endereco para confirmacao.',
            rows: 3,
        },
        {
            id: 'delivery-cep-confirm',
            title: 'Confirmar endereco',
            subtitle: 'Depois da consulta do CEP',
            customerLabel: 'Cliente confirma ou troca CEP',
            customerText: 'sim, nao, outro CEP',
            botLabel: 'Bot confirma endereco',
            botText: 'Encontrei este endereco:\nRua: Rua Marechal Deodoro\nBairro: Centro\nCidade: Petrolina - PE\nCEP: 56304-000\n\nSe estiver correto, me envie o numero da casa.\nSe tiver complemento, pode mandar junto. Ex: 123 apto 202\nSe esse nao for o endereco, envie outro CEP.',
            rows: 7,
        },
        {
            id: 'delivery-number',
            title: 'Numero e complemento',
            subtitle: 'Quando o endereco do CEP esta certo',
            customerLabel: 'Cliente pode responder',
            customerText: '123, 123 apto 202, s/n',
            botLabel: 'Bot pede numero',
            botText: 'Agora me envie o numero da casa/predio. Se tiver complemento, pode mandar junto. Ex: 123, apto 202',
            rows: 3,
        },
        {
            id: 'delivery-address-saved',
            title: 'Endereco completo',
            subtitle: 'Depois de numero e complemento',
            customerLabel: 'Cliente enviou',
            customerText: '123 apto 202',
            botLabel: 'Bot registra endereco',
            botText: 'Endereco anotado.\n\nEndereco de entrega:\nRua Marechal Deodoro, 123\nComplemento: apto 202\nCentro - Petrolina/PE\nCEP: 56304-000\n\nAgora vamos combinar a forma de pagamento.\n\nComo prefere pagar? Pix, dinheiro, debito ou cartao de credito?',
            rows: 8,
        },
        {
            id: 'pickup',
            title: 'Retirada na loja',
            subtitle: 'Quando o cliente escolhe retirada',
            customerLabel: 'Cliente escolheu',
            customerText: 'retirada',
            botLabel: 'Bot responde',
            messageKey: 'pickup_reply',
            rows: 2,
        },
        {
            id: 'payment-method',
            title: 'Forma de pagamento',
            subtitle: 'Depois de entrega ou retirada',
            customerLabel: 'Cliente pode dizer',
            customerText: 'pix, dinheiro, debito, cartao',
            botLabel: 'Bot pergunta',
            botText: 'Como prefere pagar? Pix, dinheiro, debito ou cartao de credito?\n\nTotal a vista: R$ 980,00',
            rows: 3,
        },
        {
            id: 'payment-card-entry',
            title: 'Entrada no cartao',
            subtitle: 'Quando cliente escolhe credito',
            customerLabel: 'Cliente pode responder',
            customerText: '200, sem entrada',
            botLabel: 'Bot pergunta',
            botText: 'Vai ter entrada para abater antes de parcelar no cartao?\n\nSe tiver, envie o valor da entrada. Ex: 200\nSe nao tiver entrada, responda "sem entrada".',
            rows: 5,
        },
        {
            id: 'payment-card-installments',
            title: 'Tabela de parcelas',
            subtitle: 'Juros somente sobre saldo do cartao',
            customerLabel: 'Cliente informou entrada',
            customerText: '200',
            botLabel: 'Bot mostra tabela',
            botText: 'Tabela do cartao\nTotal do pedido: R$ 980,00\nEntrada: R$ 200,00\nValor no cartao: R$ 780,00\n\n1x de R$ 780,00 = R$ 780,00\n2x de R$ 410,00 = R$ 820,00\n...\n12x de R$ 78,00 = R$ 936,00',
            rows: 8,
        },
        {
            id: 'payment-card-choice',
            title: 'Pagamento combinado',
            subtitle: 'Depois da parcela escolhida',
            customerLabel: 'Cliente escolheu',
            customerText: '5x',
            botLabel: 'Bot confirma',
            botText: 'Combinado, deixei o pagamento como:\nCartao em 5x de R$ 180,00\nEntrada: R$ 200,00\nTotal no cartao: R$ 900,00\n\nAgora vou confirmar os dados do cadastro para separar seu pedido.',
            rows: 6,
        },
        {
            id: 'human',
            title: 'Atendente humano',
            subtitle: 'Quando precisa passar para equipe',
            customerLabel: 'Cliente pode dizer',
            customerText: 'atendente, humano, vendedor, falar com alguem',
            botLabel: 'Bot responde',
            messageKey: 'human_handoff_reply',
            rows: 2,
        },
    ];

    return (
        <div className="mx-auto max-w-7xl space-y-6 pb-16">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">AutoResponder</h1>
                        <p className="text-sm text-slate-500">WhatsApp AutoResponder</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                            enabled
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-600'
                        }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {enabled ? 'Ativo' : 'Desativado'}
                    </span>
                    <button
                        type="button"
                        onClick={loadDashboard}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Atualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label="Mensagens 7d" value={formatNumber(summary.total_messages)} tone="blue" icon={<MessageCircle size={18} />} />
                <MetricTile label="Contatos únicos" value={formatNumber(summary.unique_senders)} tone="emerald" icon={<Users size={18} />} />
                <MetricTile label="Fallbacks" value={formatNumber(summary.fallback_messages)} tone="amber" icon={<AlertCircle size={18} />} />
                <MetricTile label="Loja" value={getStoreStatusLabel(storeStatus)} icon={<Clock size={18} />} />
            </div>

            <section className={`rounded-lg border p-4 ${
                aiFinanceNeedsAttention
                    ? 'border-red-200 bg-red-50'
                    : 'border-emerald-200 bg-emerald-50'
            }`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Resumo financeiro da IA</p>
                        <h2 className="mt-1 text-lg font-bold text-slate-950">
                            Saldo oficial estimado: {aiDisplayedRemainingCredit == null ? '-' : formatUsd(aiDisplayedRemainingCredit)}
                        </h2>
                    </div>
                    <a
                        href="?aba=configuracoes#controle-financeiro-ia"
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        <Settings size={16} />
                        Ajustar financeiro
                    </a>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-lg border border-white/70 bg-white p-3">
                        <span className="block text-xs font-semibold text-slate-500">Gasto oficial OpenAI</span>
                        <strong className="mt-1 block text-base text-slate-950">
                            {aiFinance?.openai_official_month_cost_usd == null ? 'Pendente' : formatUsd(aiFinance.openai_official_month_cost_usd)}
                        </strong>
                    </div>
                    <div className="rounded-lg border border-white/70 bg-white p-3">
                        <span className="block text-xs font-semibold text-slate-500">Credito informado</span>
                        <strong className="mt-1 block text-base text-slate-950">{formatUsd(aiFinance?.credit_balance_usd)}</strong>
                    </div>
                    <div className="rounded-lg border border-white/70 bg-white p-3">
                        <span className="block text-xs font-semibold text-slate-500">Gasto interno estimado</span>
                        <strong className="mt-1 block text-base text-slate-950">{formatUsd(aiFinance?.month_estimated_cost_usd)}</strong>
                    </div>
                    <div className="rounded-lg border border-white/70 bg-white p-3">
                        <span className="block text-xs font-semibold text-slate-500">Chave admin</span>
                        <strong className={aiHasAdminKey ? 'mt-1 block text-base text-emerald-700' : 'mt-1 block text-base text-amber-700'}>
                            {aiHasAdminKey ? 'Conectada' : 'Pendente'}
                        </strong>
                    </div>
                </div>
            </section>

            <Tabs defaultTab="respostas" urlParam="aba" onChange={setActiveAutoResponderTab} className="space-y-5">
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <TabList className="min-w-max border-b-0">
                        {tabs.map((tab) => (
                            <Tab key={tab.id} id={tab.id} label={tab.label} icon={tab.icon} className="whitespace-nowrap px-4" />
                        ))}
                    </TabList>
                </div>

                <TabPanels className="space-y-4">
                    <TabPanel id="fluxos">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
                            <aside className="rounded-lg border border-slate-200 bg-white">
                                <div className="border-b border-slate-200 px-4 py-3">
                                    <h2 className="text-base font-semibold text-slate-900">Fluxos de conversa</h2>
                                    <p className="mt-1 text-sm text-slate-500">A conversa completa, etapa por etapa.</p>
                                </div>
                                <div className="divide-y divide-slate-100">
                                    {conversationEditorSteps.map((step, index) => (
                                        <div
                                            key={step.id}
                                            className={`flex items-start gap-3 px-4 py-3 ${
                                                index < 3 ? 'border-l-4 border-emerald-500 bg-emerald-50' : 'border-l-4 border-transparent'
                                            }`}
                                        >
                                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-700 shadow-sm">
                                                {index + 1}
                                            </span>
                                            <span>
                                                <span className="block text-sm font-bold text-slate-950">{step.title}</span>
                                                <span className="mt-1 block text-xs text-slate-600">{step.subtitle}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </aside>

                            <section className="rounded-lg border border-slate-200 bg-white">
                                <div className="border-b border-slate-200 px-5 py-4">
                                    <p className="text-xs font-semibold uppercase text-emerald-700">Fluxo completo</p>
                                    <h2 className="mt-1 text-lg font-bold text-slate-950">Atendimento pelo WhatsApp</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Edite a fala do bot e as palavras que fazem cada etapa continuar sem sair do contexto.
                                    </p>
                                </div>

                                <div className="space-y-5 px-5 py-5">
                                    {conversationEditorSteps.map((step, index) => (
                                        <div key={step.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">
                                                            {index + 1}
                                                        </span>
                                                        {step.title}
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-500">{step.subtitle}</p>
                                                </div>
                                                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">
                                                    {step.customerEditable ? 'palavras editaveis' : 'resposta editavel'}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                                <label className="block">
                                                    <span className="mb-2 block text-sm font-semibold text-slate-700">{step.customerLabel}</span>
                                                    {step.customerEditable ? (
                                                        <AutoResizeTextarea
                                                            value={settingsForm.conversation_flow_keywords.phone_list_opt_in || ''}
                                                            onChange={(event) => updateConversationFlowKeywords('phone_list_opt_in', event.target.value)}
                                                            minRows={3}
                                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                        />
                                                    ) : (
                                                        <div className="min-h-[76px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-600">
                                                            {step.customerText}
                                                        </div>
                                                    )}
                                                </label>

                                                <label className="block">
                                                    <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                                                        <Bot size={16} />
                                                        {step.botLabel}
                                                    </span>
                                                    {step.messageKey ? (
                                                        <AutoResizeTextarea
                                                            value={flowMessages[step.messageKey] || ''}
                                                            onChange={(event) => updateConversationFlowMessage(step.messageKey, event.target.value)}
                                                            minRows={step.rows}
                                                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                        />
                                                    ) : (
                                                        <div className="whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-600">
                                                            {step.botText}
                                                        </div>
                                                    )}
                                                    {step.helper && (
                                                        <p className="mt-2 text-xs text-slate-500">{step.helper}</p>
                                                    )}
                                                </label>
                                            </div>
                                        </div>
                                    ))}

                                    <label className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                        <input
                                            type="checkbox"
                                            checked={settingsForm.ai_enabled}
                                            onChange={(event) => updateSettingsForm({ ai_enabled: event.target.checked })}
                                            className="mt-1 h-4 w-4 rounded border-blue-300"
                                        />
                                        <span>
                                            <span className="block text-sm font-bold text-blue-900">IA na linha de frente</span>
                                            <span className="mt-1 block text-sm text-blue-800">
                                                Quando a resposta nao bater nas palavras acima, a IA interpreta a intencao antes do bot desistir ou fazer uma busca errada.
                                            </span>
                                        </span>
                                    </label>

                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            onClick={saveSettings}
                                            disabled={isSavingSettings}
                                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                        >
                                            <Save size={16} />
                                            {isSavingSettings ? 'Salvando...' : 'Salvar fluxo'}
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <aside className="rounded-lg border border-slate-200 bg-[#efe7dc] p-4">
                                <div className="mb-3 flex items-center gap-2 border-b border-black/10 pb-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">M</div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">Preview da conversa</h3>
                                        <p className="text-xs text-slate-600">Mercado do Vale</p>
                                    </div>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        {flowMessages.greeting_reply}
                                    </div>
                                    <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        {flowMessages.phone_list_prompt}
                                    </div>
                                    <div className="ml-auto max-w-[78%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-900 shadow-sm">
                                        quero
                                    </div>
                                    <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        {flowMessages.phone_list_reply}<br />
                                        <br />
                                        1. Redmi Note 14<br />
                                        2. iPhone 13<br />
                                        3. Samsung Galaxy A16
                                    </div>
                                    <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        {flowMessages.name_prompt}
                                    </div>
                                    <div className="ml-auto max-w-[72%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-900 shadow-sm">
                                        Handielson Amorim
                                    </div>
                                    <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        {flowMessages.fulfillment_prompt}
                                    </div>
                                    <div className="ml-auto max-w-[72%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-900 shadow-sm">
                                        entrega
                                    </div>
                                    <div className="max-w-[88%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        {flowMessages.delivery_cep_prompt}
                                    </div>
                                    <div className="ml-auto max-w-[72%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-900 shadow-sm">
                                        56.304-000
                                    </div>
                                    <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        Encontrei este endereco:<br />
                                        Rua: Rua Marechal Deodoro<br />
                                        Bairro: Centro<br />
                                        Cidade: Petrolina - PE<br />
                                        CEP: 56304-000<br />
                                        <br />
                                        Se estiver correto, me envie o numero da casa.
                                        Se tiver complemento, pode mandar junto. Ex: 123 apto 202
                                        Se esse nao for o endereco, envie outro CEP.
                                    </div>
                                    <div className="ml-auto max-w-[72%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-slate-900 shadow-sm">
                                        123 apto 202
                                    </div>
                                    <div className="max-w-[92%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-slate-800 shadow-sm">
                                        Endereco anotado.<br />
                                        <br />
                                        Endereco de entrega:<br />
                                        Rua Marechal Deodoro, 123<br />
                                        Complemento: apto 202<br />
                                        Centro - Petrolina/PE<br />
                                        CEP: 56304-000
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </TabPanel>

                    <TabPanel id="respostas">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white">
                                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Respostas automáticas</h2>
                                        <p className="text-sm text-slate-500">
                                            {filteredRules.length} de {rules.length} regras exibidas
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={openNewRule}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        <Plus size={16} />
                                        Nova resposta
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-3 border-b border-slate-200 px-5 py-4 md:grid-cols-[1fr_180px_220px]">
                                    <label className="relative block">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={ruleSearch}
                                            onChange={(event) => setRuleSearch(event.target.value)}
                                            placeholder="Buscar por nome, palavras-chave ou resposta"
                                            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>

                                    <select
                                        value={ruleStatusFilter}
                                        onChange={(event) => setRuleStatusFilter(event.target.value as RuleStatusFilter)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="all">Todos os status</option>
                                        <option value="active">Ativas</option>
                                        <option value="inactive">Inativas</option>
                                    </select>

                                    <select
                                        value={ruleTagFilter}
                                        onChange={(event) => setRuleTagFilter(event.target.value)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">Todas as tags</option>
                                        {tags.map((tag) => (
                                            <option key={tag.id} value={tag.id}>{tag.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                                            <tr>
                                                <th className="px-5 py-3">Nome</th>
                                                <th className="px-5 py-3">Palavras-chave</th>
                                                <th className="px-5 py-3">Tipo de resposta</th>
                                                <th className="px-5 py-3 text-right">Acertos</th>
                                                <th className="px-5 py-3">Status</th>
                                                <th className="px-5 py-3 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {filteredRules.map((rule) => {
                                                const ruleTagIds = parseTagIds(rule.tag_ids);
                                                return (
                                                    <tr key={rule.id} className="align-top hover:bg-slate-50">
                                                        <td className="px-5 py-4">
                                                            <div className="font-semibold text-slate-900">{rule.name}</div>
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {ruleTagIds.map((tagId) => (
                                                                    <span key={tagId} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                                                        {getTagName(tags, tagId)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td className="max-w-sm px-5 py-4 text-slate-600">{rule.pattern}</td>
                                                        <td className="px-5 py-4 text-slate-600">{rule.reply_type}</td>
                                                        <td className="px-5 py-4 text-right font-semibold text-slate-900">{formatNumber(rule.hits)}</td>
                                                        <td className="px-5 py-4">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleRuleActive(rule)}
                                                                disabled={togglingRuleId === rule.id}
                                                                aria-label={`${isEnabled(rule.active) ? 'Desativar' : 'Ativar'} resposta ${rule.name}`}
                                                                className={`inline-flex min-w-[92px] items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                                                    isEnabled(rule.active)
                                                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                                }`}
                                                            >
                                                                {togglingRuleId === rule.id
                                                                    ? 'Salvando...'
                                                                    : isEnabled(rule.active) ? 'Desativar' : 'Ativar'}
                                                            </button>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditRule(rule)}
                                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                            >
                                                                <Edit3 size={15} />
                                                                Editar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteRule(rule)}
                                                                disabled={deletingRuleId === rule.id}
                                                                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                                                            >
                                                                <Trash2 size={15} />
                                                                {deletingRuleId === rule.id ? 'Excluindo...' : 'Excluir'}
                                                            </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {filteredRules.length === 0 && (
                                        <div className="px-5 py-10 text-center text-sm text-slate-500">
                                            Nenhuma resposta encontrada.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabPanel>
                    <TabPanel id="conversas">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white">
                                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Conversas</h2>
                                        <p className="text-sm text-slate-500">
                                            {filteredConversations.length} de {conversations.length} conversas exibidas
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={reloadConversations}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <RefreshCw size={16} />
                                        Atualizar conversas
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-3 border-b border-slate-200 px-5 py-4 md:grid-cols-[1fr_180px_220px]">
                                    <label className="relative block">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            value={conversationSearch}
                                            onChange={(event) => setConversationSearch(event.target.value)}
                                            placeholder="Buscar por número, nome ou última mensagem"
                                            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>

                                    <select
                                        value={conversationStatusFilter}
                                        onChange={(event) => setConversationStatusFilter(event.target.value as ConversationStatusFilter)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="all">Todos os status</option>
                                        <option value="active">Ativas</option>
                                        <option value="paused">Pausadas</option>
                                    </select>

                                    <select
                                        value={conversationTagFilter}
                                        onChange={(event) => setConversationTagFilter(event.target.value)}
                                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">Todas as tags</option>
                                        {conversationTags.map((tag) => (
                                            <option key={tag.id} value={tag.id}>{tag.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                {filteredConversations.map((conversation) => {
                                    const paused = isConversationPaused(conversation);
                                    const draftTags = conversationTagDrafts[conversation.sender] || parseTagIds(conversation.tag_ids);
                                    const busy = conversationActionSender === conversation.sender;
                                    return (
                                        <div key={conversation.sender} className="rounded-lg border border-slate-200 bg-white p-5">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-semibold text-slate-900">{conversation.contact_name || conversation.sender}</h3>
                                                        <span
                                                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                                                                paused
                                                                    ? 'bg-amber-50 text-amber-700'
                                                                    : 'bg-emerald-50 text-emerald-700'
                                                            }`}
                                                        >
                                                            {paused ? 'Pausada' : 'Ativa'}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 font-mono text-xs text-slate-500">{conversation.sender}</p>
                                                </div>
                                                <div className="text-left text-xs text-slate-500 sm:text-right">
                                                    <p>Última mensagem</p>
                                                    <p className="font-semibold text-slate-700">{formatDateTime(conversation.last_message_at)}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4 rounded-lg bg-slate-50 p-3">
                                                <p className="text-xs font-semibold uppercase text-slate-500">Última mensagem</p>
                                                <p className="mt-1 text-sm text-slate-700">{conversation.last_message || 'Sem mensagem registrada.'}</p>
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Mensagens</p>
                                                    <p className="font-bold text-slate-900">{formatNumber(conversation.total_messages)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Respostas</p>
                                                    <p className="font-bold text-slate-900">{formatNumber(conversation.reply_count)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Fallbacks</p>
                                                    <p className="font-bold text-slate-900">{formatNumber(conversation.consecutive_fallbacks)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold uppercase text-slate-500">Pausa até</p>
                                                    <p className="font-bold text-slate-900">{paused ? formatDateTime(conversation.paused_until) : '-'}</p>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Tags</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {conversationTags.map((tag) => {
                                                        const selected = draftTags.includes(Number(tag.id));
                                                        return (
                                                            <button
                                                                key={tag.id}
                                                                type="button"
                                                                onClick={() => toggleConversationTagDraft(conversation.sender, Number(tag.id))}
                                                                className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                                                                    selected
                                                                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                {tag.name}
                                                            </button>
                                                        );
                                                    })}
                                                    {conversationTags.length === 0 && (
                                                        <span className="text-sm text-slate-500">Nenhuma tag de conversa cadastrada.</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => pauseConversation(conversation.sender, 60)}
                                                    disabled={busy}
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                                >
                                                    Pausar 1h
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => pauseConversation(conversation.sender, 240)}
                                                    disabled={busy}
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                                >
                                                    Pausar 4h
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => pauseConversation(conversation.sender, 1440)}
                                                    disabled={busy}
                                                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                                >
                                                    Pausar 24h
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => resumeConversation(conversation.sender)}
                                                    disabled={busy}
                                                    className="rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                                                >
                                                    Liberar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => resetConversationCounters(conversation.sender)}
                                                    disabled={busy}
                                                    title="Limpa pausa e contadores para o bot voltar a responder esta conversa"
                                                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                                                >
                                                    Reiniciar conversa
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => saveConversationTags(conversation.sender)}
                                                    disabled={busy}
                                                    className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                                >
                                                    Salvar tags
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => blockConversation(conversation)}
                                                    disabled={busy}
                                                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                                                >
                                                    Bloquear
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {filteredConversations.length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
                                    Nenhuma conversa encontrada.
                                </div>
                            )}
                        </div>
                    </TabPanel>
                    <TabPanel id="bloqueados">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Bloqueados</h2>
                                        <p className="text-sm text-slate-500">
                                            {filteredBlocklist.length} de {blocklist.length} bloqueios exibidos
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={openBlockModal}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                        >
                                            <Plus size={16} />
                                            Adicionar bloqueio
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsBulkBlockModalOpen(true)}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            <Ban size={16} />
                                            Importar em massa
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                    <Search size={16} className="text-slate-400" />
                                    <input
                                        value={blocklistSearch}
                                        onChange={(event) => setBlocklistSearch(event.target.value)}
                                        placeholder="Buscar por número, nome, tipo ou motivo"
                                        className="w-full border-0 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Padrão
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Tipo
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Nome
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Motivo
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Status
                                            </th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {filteredBlocklist.map((entry) => {
                                            const active = isEnabled(entry.active);
                                            const busy = blocklistActionId === entry.id;
                                            return (
                                                <tr key={entry.id} className="align-top hover:bg-slate-50">
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-900">{entry.pattern}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            Criado em {formatDateTime(entry.created_at)}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">{entry.pattern_type}</td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {entry.contact_name || 'Sem nome'}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {entry.reason || 'Sem motivo'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                                                active
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}
                                                        >
                                                            {active ? 'Ativo' : 'Inativo'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditBlockModal(entry)}
                                                                disabled={busy}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <Edit3 size={16} />
                                                                Editar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteBlocklistEntry(entry)}
                                                                disabled={busy}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <X size={16} />
                                                                Excluir
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredBlocklist.length === 0 && (
                                    <div className="px-5 py-10 text-center text-sm text-slate-500">
                                        Nenhum bloqueio encontrado.
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabPanel>
                    <TabPanel id="curadoria">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Curadoria</h2>
                                        <p className="text-sm text-slate-500">
                                            {filteredUnansweredQuestions.length} de {unansweredQuestions.length} perguntas sem resposta
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={reloadUnansweredQuestions}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <RefreshCw size={16} />
                                        Atualizar
                                    </button>
                                </div>

                                <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                    <Search size={16} className="text-slate-400" />
                                    <input
                                        value={curationSearch}
                                        onChange={(event) => setCurationSearch(event.target.value)}
                                        placeholder="Buscar pergunta"
                                        className="w-full border-0 text-sm outline-none"
                                    />
                                </div>

                                {curationNotice && (
                                    <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                        <CheckCircle2 size={16} />
                                        {curationNotice}
                                    </div>
                                )}
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Pergunta
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Frequência
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Última vez
                                            </th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {filteredUnansweredQuestions.map((question) => {
                                            const busy = curationActionQuestion === question.question;
                                            return (
                                                <tr key={question.question} className="align-top hover:bg-slate-50">
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-900">{question.question}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            Perguntas sem resposta
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                                                        {formatNumber(question.occurrences)}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {formatDateTime(question.last_seen_at)}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-wrap justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openRuleModalFromUnansweredQuestion(question)}
                                                                disabled={busy}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <Plus size={16} />
                                                                Criar resposta
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => ignoreUnansweredQuestion(question)}
                                                                disabled={busy}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <X size={16} />
                                                                Ignorar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredUnansweredQuestions.length === 0 && (
                                    <div className="px-5 py-10 text-center text-sm text-slate-500">
                                        Nenhuma pergunta sem resposta encontrada.
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabPanel>
                    <TabPanel id="tags">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Tags</h2>
                                        <p className="text-sm text-slate-500">
                                            {filteredTags.length} de {tags.length} tags exibidas
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={openNewTag}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                    >
                                        <Plus size={16} />
                                        Nova tag
                                    </button>
                                </div>

                                <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                    <Search size={16} className="text-slate-400" />
                                    <input
                                        value={tagSearch}
                                        onChange={(event) => setTagSearch(event.target.value)}
                                        placeholder="Buscar por nome, cor, escopo ou descrição"
                                        className="w-full border-0 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-amber-950">Previa da saudacao automatica</h3>
                                        <p className="mt-1 text-sm text-amber-800">
                                            Esta e a amostra da mensagem que o bot envia quando o cliente manda apenas uma saudacao.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => copyCategoryTagPlaceholder(greetingCategoryPreviewText)}
                                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                                    >
                                        <Copy size={16} />
                                        {copiedCategoryTagPlaceholder === greetingCategoryPreviewText ? 'Copiado' : 'Copiar amostra'}
                                    </button>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
                                    <pre className="min-h-[180px] whitespace-pre-wrap rounded-lg border border-amber-100 bg-white p-4 text-sm leading-6 text-slate-800 shadow-sm">
                                        {greetingCategoryPreviewText}
                                    </pre>
                                    <div className="rounded-lg border border-amber-100 bg-white p-4">
                                        <h4 className="text-sm font-semibold text-slate-900">Categorias que aparecem nesta mensagem</h4>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Entra aqui somente categoria com produto ativo e estoque disponivel.
                                        </p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {greetingCategoryPreviewCategories.length > 0 ? (
                                                greetingCategoryPreviewCategories.map((category) => (
                                                    <span
                                                        key={category.id}
                                                        className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                                                    >
                                                        {category.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-sm text-slate-500">Nenhuma categoria aparece agora.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-emerald-200 bg-white">
                                <div className="flex flex-col gap-1 border-b border-emerald-100 bg-emerald-50 px-5 py-4">
                                    <h3 className="text-base font-semibold text-emerald-900">Tags de categoria</h3>
                                    <p className="text-sm text-emerald-700">
                                        Categorias dinamicas. Vem da tabela categories e muda automaticamente quando a categoria ou seus produtos mudam.
                                    </p>
                                </div>
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Categoria</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Produtos ativos</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Com estoque</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Garantia</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Bot</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Copiar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {filteredCategoryTags.map((category) => {
                                            const appearsOnGreeting = isEnabled(category.appears_on_greeting);
                                            const categoryPlaceholder = `{categoria:${category.name}}`;
                                            return (
                                                <tr key={category.id} className="align-top hover:bg-slate-50">
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-900">{category.name}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            Vem da tabela categories{category.slug ? ` - ${category.slug}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                                        {formatNumber(category.product_count)}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-semibold text-slate-900">
                                                        {formatNumber(category.in_stock_count)}
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {category.warranty_days ? `${category.warranty_days} dias` : 'Conforme produto'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                                                appearsOnGreeting
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}
                                                        >
                                                            {appearsOnGreeting ? 'Aparece na saudacao' : 'Sem estoque ativo'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <button
                                                            type="button"
                                                            onClick={() => copyCategoryTagPlaceholder(`{categoria:${category.name}}`)}
                                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                                                            title={`Copiar ${categoryPlaceholder}`}
                                                        >
                                                            <Copy size={16} />
                                                            {copiedCategoryTagPlaceholder === categoryPlaceholder ? 'Copiado' : 'Copiar tag'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredCategoryTags.length === 0 && (
                                    <div className="px-5 py-10 text-center text-sm text-slate-500">
                                        Nenhuma categoria dinamica encontrada.
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                                <h3 className="text-base font-semibold text-blue-950">Informativos para outras mensagens</h3>
                                <p className="mt-1 text-sm text-blue-800">
                                    Use nas respostas automáticas para reaproveitar as categorias dinamicas sem manter texto manual.
                                </p>
                                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                    <div className="rounded-lg border border-blue-100 bg-white p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <code className="text-sm font-semibold text-blue-900">{'{categorias_disponiveis}'}</code>
                                            <button
                                                type="button"
                                                onClick={() => copyCategoryTagPlaceholder('{categorias_disponiveis}')}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                                            >
                                                <Copy size={16} />
                                                {copiedCategoryTagPlaceholder === '{categorias_disponiveis}' ? 'Copiado' : 'Copiar tag'}
                                            </button>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Insere a lista numerada atual de categorias com produtos em estoque.
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-blue-100 bg-white p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <code className="text-sm font-semibold text-blue-900">{'{categoria:Nome da categoria}'}</code>
                                            <button
                                                type="button"
                                                onClick={() => copyCategoryTagPlaceholder('{categoria:Nome da categoria}')}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                                            >
                                                <Copy size={16} />
                                                {copiedCategoryTagPlaceholder === '{categoria:Nome da categoria}' ? 'Copiado' : 'Copiar tag'}
                                            </button>
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                            Insere uma lista curta de produtos da categoria informada, por exemplo {'{categoria:Smartphones}'}.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Nome
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Cor
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Escopo
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Descrição
                                            </th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                                                Bot
                                            </th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {filteredTags.map((tag) => {
                                            const busy = tagActionId === tag.id;
                                            const scopeLabels = [
                                                tagScopesIncludes(tag, 'conversation') ? 'Conversas' : '',
                                                tagScopesIncludes(tag, 'product') ? 'Produtos' : '',
                                                tagScopesIncludes(tag, 'rule') ? 'Regras' : '',
                                            ].filter(Boolean);
                                            return (
                                                <tr key={tag.id} className="align-top hover:bg-slate-50">
                                                    <td className="px-5 py-4">
                                                        <div className="font-semibold text-slate-900">{tag.name}</div>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            Criada em {formatDateTime(tag.created_at)}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                                            <span
                                                                className="h-5 w-5 rounded-full border border-slate-200"
                                                                style={{ backgroundColor: tag.color || '#6b7280' }}
                                                            />
                                                            {tag.color || '#6b7280'}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {(scopeLabels.length ? scopeLabels : ['Sem escopo']).map((scope) => (
                                                                <span
                                                                    key={scope}
                                                                    className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700"
                                                                >
                                                                    {scope}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm text-slate-600">
                                                        {tag.description || 'Sem descrição'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <span
                                                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                                                isEnabled(tag.show_on_bot)
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-slate-100 text-slate-600'
                                                            }`}
                                                        >
                                                            {isEnabled(tag.show_on_bot) ? 'Visível' : 'Oculta'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-wrap justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => copyCategoryTagPlaceholder(tag.name)}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                                                                title={`Copiar tag ${tag.name}`}
                                                            >
                                                                <Copy size={16} />
                                                                {copiedCategoryTagPlaceholder === tag.name ? 'Copiado' : 'Copiar tag'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditTag(tag)}
                                                                disabled={busy}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <Edit3 size={16} />
                                                                Editar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => deleteTag(tag)}
                                                                disabled={busy}
                                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <X size={16} />
                                                                Excluir
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {filteredTags.length === 0 && (
                                    <div className="px-5 py-10 text-center text-sm text-slate-500">
                                        Nenhuma tag encontrada.
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabPanel>
                    <TabPanel id="estatisticas">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Histórico Synology</h2>
                                        <p className="text-sm text-slate-500">Alterne entre estatísticas recentes do MySQL e histórico arquivado.</p>
                                    </div>
                                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                                        <button
                                            type="button"
                                            onClick={() => setStatsSource('mysql')}
                                            className={`rounded-md px-3 py-2 text-sm font-semibold ${
                                                statsSource === 'mysql'
                                                    ? 'bg-white text-blue-700 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            MySQL 7 dias
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStatsSource('synology')}
                                            className={`rounded-md px-3 py-2 text-sm font-semibold ${
                                                statsSource === 'synology'
                                                    ? 'bg-white text-blue-700 shadow-sm'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Synology
                                        </button>
                                    </div>
                                </div>
                                {statsSource === 'synology' && (
                                    <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-slate-700 sm:max-w-xs">
                                        Data do archive
                                        <input
                                            type="date"
                                            value={statsFrom}
                                            onChange={(event) => setStatsFrom(event.target.value)}
                                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                )}
                                {stats?.warning && (
                                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                                        {stats.warning}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <MetricTile label="Mensagens 7 dias" value={formatNumber(totalMessages)} tone="blue" icon={<MessageCircle size={18} />} />
                                <MetricTile label="Contatos únicos" value={formatNumber(summary.unique_senders)} tone="emerald" icon={<Users size={18} />} />
                                <MetricTile label="Taxa de resposta" value={`${responseRate}%`} tone="slate" icon={<CheckCircle2 size={18} />} />
                                <MetricTile label="Fora de cobertura" value={formatNumber(fallbackMessages)} tone="amber" icon={<AlertCircle size={18} />} />
                                <MetricTile label="Tempo médio" value={`${formatNumber(summary.avg_response_time_ms)} ms`} tone="slate" icon={<Clock size={18} />} />
                            </div>

                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <div className="rounded-lg border border-slate-200 bg-white xl:col-span-2">
                                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                                        <div>
                                            <h3 className="text-base font-semibold text-slate-900">Gráfico por intent</h3>
                                            <p className="text-sm text-slate-500">Distribuição dos últimos 7 dias</p>
                                        </div>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                            Histórico Synology em fase futura
                                        </span>
                                    </div>
                                    <div className="space-y-3 px-5 py-5">
                                        {(stats?.byIntent || []).slice(0, 8).map((item) => (
                                            <div key={item.intent} className="space-y-1">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-medium text-slate-700">{item.intent}</span>
                                                    <span className="font-semibold text-slate-900">{formatNumber(item.total)}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-slate-100">
                                                    <div
                                                        className="h-2 rounded-full bg-blue-600"
                                                        style={{ width: `${Math.max(6, (Number(item.total || 0) / maxIntentTotal) * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        {(!stats?.byIntent || stats.byIntent.length === 0) && (
                                            <div className="py-6 text-center text-sm text-slate-500">Sem estatísticas carregadas.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white">
                                    <div className="border-b border-slate-200 px-5 py-4">
                                        <h3 className="text-base font-semibold text-slate-900">Resumo</h3>
                                        <p className="text-sm text-slate-500">Respostas classificadas</p>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        <div className="flex items-center justify-between px-5 py-3 text-sm">
                                            <span className="text-slate-600">Produtos respondidos</span>
                                            <span className="font-semibold text-slate-900">{formatNumber(productMessages)}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-5 py-3 text-sm">
                                            <span className="text-slate-600">Chamadas humanas</span>
                                            <span className="font-semibold text-slate-900">{formatNumber(humanRequests)}</span>
                                        </div>
                                        <div className="flex items-center justify-between px-5 py-3 text-sm">
                                            <span className="text-slate-600">Fallbacks</span>
                                            <span className="font-semibold text-slate-900">{formatNumber(fallbackMessages)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <div className="rounded-lg border border-slate-200 bg-white">
                                    <div className="border-b border-slate-200 px-5 py-4">
                                        <h3 className="text-base font-semibold text-slate-900">Top produtos perguntados</h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {(stats?.topProducts || []).slice(0, 10).map((product) => (
                                            <div key={product.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                                                <div>
                                                    <div className="font-semibold text-slate-900">{product.name}</div>
                                                    <div className="mt-1 text-xs text-slate-500">SKU: {product.sku || 'N/D'}</div>
                                                </div>
                                                <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                                                    {formatNumber(product.total)}
                                                </span>
                                            </div>
                                        ))}
                                        {(!stats?.topProducts || stats.topProducts.length === 0) && (
                                            <div className="px-5 py-6 text-sm text-slate-500">Sem produtos ranqueados.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white">
                                    <div className="border-b border-slate-200 px-5 py-4">
                                        <h3 className="text-base font-semibold text-slate-900">Top regras</h3>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {(stats?.topRules || []).slice(0, 10).map((rule) => (
                                            <div key={rule.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                                                <div className="font-semibold text-slate-900">{rule.name}</div>
                                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                                    {formatNumber(rule.hits)}
                                                </span>
                                            </div>
                                        ))}
                                        {(!stats?.topRules || stats.topRules.length === 0) && (
                                            <div className="px-5 py-6 text-sm text-slate-500">Sem regras ranqueadas.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabPanel>
                    <TabPanel id="testes">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Testar respostas do bot</h2>
                                        <p className="text-sm text-slate-500">Simule uma mensagem pela API da VPS sem enviar WhatsApp real e sem gravar conversa.</p>
                                    </div>
                                    {testNotice && (
                                        <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                            <CheckCircle2 size={16} />
                                            {testNotice}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Mensagem do cliente</span>
                                        <textarea
                                            value={testMessage}
                                            onChange={(event) => setTestMessage(event.target.value)}
                                            rows={4}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Remetente de teste</span>
                                        <input
                                            value={testSender}
                                            onChange={(event) => setTestSender(event.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Nome do cliente</span>
                                        <input
                                            value={testContactFirstName}
                                            onChange={(event) => setTestContactFirstName(event.target.value)}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                </div>

                                <button
                                    type="button"
                                    onClick={testBotReply}
                                    disabled={isTestingReply || !testMessage.trim()}
                                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Bot size={16} />
                                    {isTestingReply ? 'Testando...' : 'Testar resposta'}
                                </button>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">Roteiro completo</h2>
                                    <p className="text-sm text-slate-500">Uma mensagem por linha, usando o mesmo remetente de teste.</p>
                                </div>

                                <label className="mt-4 block">
                                    <span className="mb-1 block text-sm font-semibold text-slate-700">Fluxo completo</span>
                                    <textarea
                                        value={testFlowMessages}
                                        onChange={(event) => setTestFlowMessages(event.target.value)}
                                        rows={7}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>

                                <button
                                    type="button"
                                    onClick={testBotFlow}
                                    disabled={isTestingFlow || !testFlowMessages.trim()}
                                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Bot size={16} />
                                    {isTestingFlow ? 'Testando...' : 'Testar fluxo completo'}
                                </button>
                            </div>

                            {testResult && (
                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Intent: {testResult.intent}</span>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Matches: {formatNumber(testResult.matched_count)}</span>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatNumber(testResult.response_time_ms)} ms</span>
                                        {testResult.matched_rule_id && (
                                            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Regra #{testResult.matched_rule_id}</span>
                                        )}
                                    </div>
                                    {testResult.warning && (
                                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                                            {testResult.warning}
                                        </div>
                                    )}

                                    <div className="mt-4 space-y-4">
                                        {editableTestReplies.length > 0 ? (
                                            editableTestReplies.map((replyText, index) => (
                                                <div key={`${testResult.intent}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <h3 className="text-sm font-semibold text-slate-900">Resposta {index + 1}</h3>
                                                        <button
                                                            type="button"
                                                            onClick={() => saveTestReply(index)}
                                                            disabled={savingTestReplyIndex === index || !replyText.trim()}
                                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            <Save size={16} />
                                                            {savingTestReplyIndex === index ? 'Salvando...' : 'Salvar resposta'}
                                                        </button>
                                                    </div>
                                                    <textarea
                                                        value={replyText}
                                                        onChange={(event) => updateEditableTestReply(index, event.target.value)}
                                                        rows={Math.max(5, Math.min(14, replyText.split('\n').length + 2))}
                                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-6 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                    />
                                                    <p className="mt-2 text-xs text-slate-500">
                                                        Se veio de uma regra de texto, salva nela. Caso contrario, cria uma nova resposta exata para esta mensagem.
                                                    </p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                                Nenhuma resposta retornada para este teste.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {testFlowResult && (
                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${testFlowResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                            {testFlowResult.ok ? 'Fluxo OK' : 'Fluxo com falha'}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                            {formatNumber(testFlowResult.steps.length)} etapas
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                            {testFlowResult.sender}
                                        </span>
                                    </div>
                                    {testFlowResult.warning && (
                                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                                            {testFlowResult.warning}
                                        </div>
                                    )}
                                    <div className="mt-4 space-y-3">
                                        {testFlowResult.steps.map((step) => (
                                            <div key={`${step.index}-${step.message}`} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                                                    <span>#{step.index}</span>
                                                    <span>{step.status_code}</span>
                                                    <span>{formatNumber(step.response_time_ms)} ms</span>
                                                </div>
                                                <div className="mt-2 text-sm font-semibold text-slate-900">{step.message}</div>
                                                <div className="mt-3 space-y-2">
                                                    {step.replies.length > 0 ? (
                                                        step.replies.map((reply, index) => (
                                                            <pre key={`${step.index}-reply-${index}`} className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800">
                                                                {reply.message}
                                                            </pre>
                                                        ))
                                                    ) : (
                                                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
                                                            Sem resposta nesta etapa.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabPanel>
                    <TabPanel id="treinamento-ia">
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <h2 className="text-lg font-semibold text-slate-900">Treinamento IA</h2>
                                <div className="mt-4 space-y-4">
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Titulo</span>
                                        <input
                                            value={aiTrainingForm.title}
                                            onChange={(event) => setAiTrainingForm((current) => ({ ...current, title: event.target.value }))}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo de treinamento</span>
                                        <select
                                            value={aiTrainingForm.training_type}
                                            onChange={(event) => setAiTrainingForm((current) => ({ ...current, training_type: event.target.value as AutoResponderAiTrainingType }))}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        >
                                            <option value="store_instruction">Instrucoes da loja</option>
                                            <option value="faq">Perguntas e respostas</option>
                                            <option value="category_guidance">Categoria/produto</option>
                                            <option value="policy">Politicas</option>
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Conteudo</span>
                                        <textarea
                                            rows={8}
                                            value={aiTrainingForm.content}
                                            onChange={(event) => setAiTrainingForm((current) => ({ ...current, content: event.target.value }))}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Prioridade</span>
                                            <input
                                                type="number"
                                                value={aiTrainingForm.priority}
                                                onChange={(event) => setAiTrainingForm((current) => ({ ...current, priority: event.target.value }))}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={aiTrainingForm.active}
                                                onChange={(event) => setAiTrainingForm((current) => ({ ...current, active: event.target.checked }))}
                                                className="h-4 w-4 rounded border-slate-300"
                                            />
                                            <span className="text-sm font-semibold text-slate-700">Ativo</span>
                                        </label>
                                    </div>
                                    {aiTrainingNotice && (
                                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                                            {aiTrainingNotice}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={handleSaveAiTraining}
                                            disabled={isSavingAiTraining}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Save size={16} />
                                            {editingAiTraining ? 'Atualizar treinamento' : 'Salvar treinamento'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingAiTraining(null);
                                                setAiTrainingForm(emptyAiTrainingForm);
                                                setAiTrainingNotice(null);
                                            }}
                                            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Limpar
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <h3 className="text-base font-semibold text-slate-900">Itens cadastrados</h3>
                                    <button
                                        type="button"
                                        onClick={() => setActiveAutoResponderTab('testes')}
                                        className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                    >
                                        Testar resposta
                                    </button>
                                </div>
                                <div className="mt-4 space-y-3">
                                    {aiTrainingEntries.map((entry) => (
                                        <div key={entry.id} className="rounded-lg border border-slate-200 p-4">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <div className="font-semibold text-slate-900">{entry.title}</div>
                                                    <div className="mt-1 text-xs font-semibold uppercase text-slate-500">
                                                        {entry.training_type} | prioridade {entry.priority} | {isEnabled(entry.active) ? 'ativo' : 'inativo'}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditAiTraining(entry)}
                                                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteAiTraining(entry)}
                                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                                                    >
                                                        Excluir
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{entry.content}</p>
                                        </div>
                                    ))}
                                    {aiTrainingEntries.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                                            Nenhum treinamento cadastrado ainda.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabPanel>
                    <TabPanel id="configuracoes">
                        <div className="space-y-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Configurações</h2>
                                        <p className="text-sm text-slate-500">Ajustes principais do atendimento automático.</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {settingsNotice && (
                                            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                                                <CheckCircle2 size={16} />
                                                {settingsNotice}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={saveSettings}
                                            disabled={isSavingSettings}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            <Save size={16} />
                                            Salvar configurações
                                        </button>
                                    </div>
                                </div>

                                <label className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={settingsForm.enabled}
                                        onChange={(event) => updateSettingsForm({ enabled: event.target.checked })}
                                        className="h-4 w-4 rounded border-slate-300"
                                    />
                                    <span className="text-sm font-semibold text-slate-700">Bot ativo</span>
                                </label>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <h3 className="text-base font-semibold text-slate-900">Amostras de mensagens automaticas</h3>
                                        <p className="text-sm text-slate-500">
                                            Mensagens geradas pelo fluxo do bot que nao aparecem como regras editaveis.
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                                    {hiddenAutoResponderMessageSamples.map((sample) => (
                                        <div key={sample.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-slate-900">{sample.title}</h4>
                                                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                        {sample.source}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => copyCategoryTagPlaceholder(sample.text)}
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                >
                                                    <Copy size={14} />
                                                    {copiedCategoryTagPlaceholder === sample.text ? 'Copiado' : 'Copiar'}
                                                </button>
                                            </div>
                                            <pre className="mt-3 min-h-[128px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800">
                                                {sample.text}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="text-base font-semibold text-slate-900">Atendimento humano</h3>
                                    <div className="mt-4 space-y-4">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Mensagem no horário</span>
                                            <textarea
                                                value={settingsForm.human_message_in_hours}
                                                onChange={(event) => updateSettingsForm({ human_message_in_hours: event.target.value })}
                                                rows={4}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Mensagem fora do horário</span>
                                            <textarea
                                                value={settingsForm.human_message_out_of_hours}
                                                onChange={(event) => updateSettingsForm({ human_message_out_of_hours: event.target.value })}
                                                rows={4}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Pausa humana</span>
                                            <input
                                                type="number"
                                                value={settingsForm.human_pause_minutes}
                                                onChange={(event) => updateSettingsForm({ human_pause_minutes: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="text-base font-semibold text-slate-900">Saudação</h3>
                                    <div className="mt-4 space-y-4">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Prefixo de saudação</span>
                                            <textarea
                                                value={settingsForm.greeting_prefix}
                                                onChange={(event) => updateSettingsForm({ greeting_prefix: event.target.value })}
                                                rows={3}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Mensagem de fallback</span>
                                            <textarea
                                                value={settingsForm.fallback_message}
                                                onChange={(event) => updateSettingsForm({ fallback_message: event.target.value })}
                                                rows={5}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.signature_enabled}
                                                onChange={(event) => updateSettingsForm({ signature_enabled: event.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300"
                                            />
                                            <span className="text-sm font-semibold text-slate-700">Usar assinatura virtual</span>
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Assinatura das respostas</span>
                                            <textarea
                                                value={settingsForm.signature_message}
                                                onChange={(event) => updateSettingsForm({ signature_message: event.target.value })}
                                                rows={3}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="text-base font-semibold text-slate-900">Auto-pausa</h3>
                                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Fallbacks até pausar</span>
                                            <input
                                                type="number"
                                                value={settingsForm.auto_pause_fallback_threshold}
                                                onChange={(event) => updateSettingsForm({ auto_pause_fallback_threshold: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Minutos pausado</span>
                                            <input
                                                type="number"
                                                value={settingsForm.auto_pause_fallback_minutes}
                                                onChange={(event) => updateSettingsForm({ auto_pause_fallback_minutes: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                    <label className="mt-4 block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Mensagem da auto-pausa</span>
                                        <textarea
                                            value={settingsForm.auto_pause_fallback_message}
                                            onChange={(event) => updateSettingsForm({ auto_pause_fallback_message: event.target.value })}
                                            rows={3}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="text-base font-semibold text-slate-900">Limites</h3>
                                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Máx. respostas por conversa</span>
                                            <input
                                                type="number"
                                                value={settingsForm.max_replies_per_conversation}
                                                onChange={(event) => updateSettingsForm({ max_replies_per_conversation: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Janela em horas</span>
                                            <input
                                                type="number"
                                                value={settingsForm.max_replies_window_hours}
                                                onChange={(event) => updateSettingsForm({ max_replies_window_hours: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="text-base font-semibold text-slate-900">Imagens</h3>
                                    <div className="mt-4 space-y-4">
                                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.send_product_images}
                                                onChange={(event) => updateSettingsForm({ send_product_images: event.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300"
                                            />
                                            <span className="text-sm font-semibold text-slate-700">Enviar imagens de produtos</span>
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Máx. imagens por resposta</span>
                                            <input
                                                type="number"
                                                value={settingsForm.max_images_per_response}
                                                onChange={(event) => updateSettingsForm({ max_images_per_response: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="text-base font-semibold text-slate-900">Listas numeradas</h3>
                                    <div className="mt-4 space-y-4">
                                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.use_numbered_lists}
                                                onChange={(event) => updateSettingsForm({ use_numbered_lists: event.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300"
                                            />
                                            <span className="text-sm font-semibold text-slate-700">Usar listas numeradas</span>
                                        </label>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <label className="block">
                                                <span className="mb-1 block text-sm font-semibold text-slate-700">Limite para listar</span>
                                                <input
                                                    type="number"
                                                    value={settingsForm.numbered_list_threshold}
                                                    onChange={(event) => updateSettingsForm({ numbered_list_threshold: event.target.value })}
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-sm font-semibold text-slate-700">Validade em minutos</span>
                                                <input
                                                    type="number"
                                                    value={settingsForm.numbered_list_validity_minutes}
                                                    onChange={(event) => updateSettingsForm({ numbered_list_validity_minutes: event.target.value })}
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
                                    <h3 className="text-base font-semibold text-slate-900">ChatGPT</h3>
                                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
                                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.ai_enabled}
                                                onChange={(event) => updateSettingsForm({ ai_enabled: event.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300"
                                            />
                                            <span className="text-sm font-semibold text-slate-700">Ativar ChatGPT nas respostas guiadas</span>
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Modelo</span>
                                            <input
                                                type="text"
                                                value={settingsForm.ai_model}
                                                onChange={(event) => updateSettingsForm({ ai_model: event.target.value })}
                                                placeholder="gpt-5-nano"
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                    <label className="mt-4 block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">OPENAI_API_KEY</span>
                                        <input
                                            type="password"
                                            value={settingsForm.openai_api_key}
                                            onChange={(event) => updateSettingsForm({ openai_api_key: event.target.value })}
                                            placeholder={settingsForm.has_openai_api_key ? `Chave salva: ${settingsForm.openai_api_key_masked}` : 'Cole uma nova chave para salvar na VPS'}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <p className="mt-2 text-xs text-slate-500">
                                        A chave fica salva somente na VPS e nao e exibida novamente. Deixe em branco para manter a chave atual.
                                    </p>
                                    <label className="mt-4 block">
                                        <span className="mb-1 block text-sm font-semibold text-slate-700">Chave Admin OpenAI</span>
                                        <input
                                            type="password"
                                            value={settingsForm.openai_admin_api_key}
                                            onChange={(event) => updateSettingsForm({ openai_admin_api_key: event.target.value })}
                                            placeholder={settingsForm.has_openai_admin_api_key ? `Chave admin salva: ${settingsForm.openai_admin_api_key_masked}` : 'Cole uma Admin API key para buscar custos oficiais'}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </label>
                                    <p className="mt-2 text-xs text-slate-500">
                                        Usada somente para consultar custos oficiais da OpenAI. Deixe em branco para manter a chave admin atual.
                                    </p>
                                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Limite diario de IA</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={settingsForm.ai_daily_limit}
                                                onChange={(event) => updateSettingsForm({ ai_daily_limit: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Limite mensal de IA</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={settingsForm.ai_monthly_limit}
                                                onChange={(event) => updateSettingsForm({ ai_monthly_limit: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                    <div id="controle-financeiro-ia" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <h4 className="text-sm font-semibold text-emerald-950">Controle financeiro da IA</h4>
                                            <a
                                                href="https://platform.openai.com/usage"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                                            >
                                                Abrir uso oficial da OpenAI
                                            </a>
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-semibold text-emerald-900">Creditos atuais (USD)</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={settingsForm.ai_credit_balance_usd}
                                                    onChange={(event) => updateSettingsForm({ ai_credit_balance_usd: event.target.value })}
                                                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-semibold text-emerald-900">Alerta abaixo de (USD)</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={settingsForm.ai_credit_alert_usd}
                                                    onChange={(event) => updateSettingsForm({ ai_credit_alert_usd: event.target.value })}
                                                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-semibold text-emerald-900">Entrada / 1M tokens</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.000001"
                                                    value={settingsForm.ai_input_cost_per_1m_usd}
                                                    onChange={(event) => updateSettingsForm({ ai_input_cost_per_1m_usd: event.target.value })}
                                                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-semibold text-emerald-900">Saida / 1M tokens</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.000001"
                                                    value={settingsForm.ai_output_cost_per_1m_usd}
                                                    onChange={(event) => updateSettingsForm({ ai_output_cost_per_1m_usd: event.target.value })}
                                                    className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                                />
                                            </label>
                                        </div>
                                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            <div>
                                                <span className="block text-xs font-semibold text-emerald-800">Gasto hoje</span>
                                                <strong className="text-sm text-emerald-950">{formatUsd(aiFinance?.today_estimated_cost_usd)}</strong>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-semibold text-emerald-800">Gasto no mes</span>
                                                <strong className="text-sm text-emerald-950">{formatUsd(aiFinance?.month_estimated_cost_usd)}</strong>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-semibold text-emerald-800">Saldo estimado</span>
                                                <strong className={Number(aiFinance?.remaining_credit_usd || 0) <= Number(settingsForm.ai_credit_alert_usd || 0) ? 'text-sm text-red-700' : 'text-sm text-emerald-950'}>
                                                    {formatUsd(aiFinance?.remaining_credit_usd)}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-semibold text-emerald-800">Tokens no mes</span>
                                                <strong className="text-sm text-emerald-950">
                                                    {formatNumber(Number(aiFinance?.month_input_tokens || 0) + Number(aiFinance?.month_output_tokens || 0))}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-semibold text-emerald-800">Gasto oficial OpenAI</span>
                                                <strong className="text-sm text-emerald-950">
                                                    {aiFinance?.openai_official_month_cost_usd == null ? 'Admin key pendente' : formatUsd(aiFinance.openai_official_month_cost_usd)}
                                                </strong>
                                            </div>
                                            <div>
                                                <span className="block text-xs font-semibold text-emerald-800">Saldo oficial estimado</span>
                                                <strong className={Number(aiFinance?.openai_official_remaining_credit_usd || 0) <= Number(settingsForm.ai_credit_alert_usd || 0) ? 'text-sm text-red-700' : 'text-sm text-emerald-950'}>
                                                    {aiFinance?.openai_official_remaining_credit_usd == null ? '-' : formatUsd(aiFinance.openai_official_remaining_credit_usd)}
                                                </strong>
                                            </div>
                                        </div>
                                        <p className="mt-3 text-xs text-emerald-800">
                                            Estimativa interna baseada nos tokens retornados pela OpenAI. Com a Chave Admin OpenAI salva, o sistema tambem consulta o gasto oficial do mes pela API de custos.
                                        </p>
                                    </div>
                                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                        O ChatGPT so pode responder usando dados enviados pelo sistema. Produtos, precos, estoque, prazos e garantias fora do catalogo oficial sao bloqueados pelo prompt do servidor.
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <h3 className="text-base font-semibold text-slate-900">Mapeamento palavra → tag</h3>
                                        <button
                                            type="button"
                                            onClick={addKeywordRow}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                                        >
                                            <Plus size={16} />
                                            Adicionar mapeamento
                                        </button>
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        {settingsKeywordRows.map((row) => (
                                            <div
                                                key={row.id}
                                                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 lg:grid-cols-[220px_1fr_auto]"
                                            >
                                                <label className="block">
                                                    <span className="mb-1 block text-sm font-semibold text-slate-700">Tag de produto</span>
                                                    <select
                                                        value={row.tagId}
                                                        onChange={(event) => updateKeywordRow(row.id, { tagId: event.target.value })}
                                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                    >
                                                        <option value="">Selecione</option>
                                                        {productTags.map((tag) => (
                                                            <option key={tag.id} value={String(tag.id)}>
                                                                {tag.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="block">
                                                    <span className="mb-1 block text-sm font-semibold text-slate-700">Palavras-chave</span>
                                                    <input
                                                        type="text"
                                                        value={row.keywords}
                                                        onChange={(event) => updateKeywordRow(row.id, { keywords: event.target.value })}
                                                        placeholder="promoção, carregador, capinha"
                                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => removeKeywordRow(row.id)}
                                                    className="inline-flex items-center justify-center gap-2 self-end rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                                >
                                                    <X size={16} />
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                        {settingsKeywordRows.length === 0 && (
                                            <div className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                                                Nenhum mapeamento cadastrado.
                                            </div>
                                        )}
                                        {productTags.length === 0 && (
                                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                                Nenhuma tag de produto cadastrada.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5">
                                    <h3 className="text-base font-semibold text-slate-900">Horário de funcionamento</h3>
                                    <a
                                        href="/admin/settings/company"
                                        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                    >
                                        <Clock size={16} />
                                        Abrir horários da empresa
                                    </a>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-5 xl:col-span-2">
                                    <h3 className="text-base font-semibold text-slate-900">Arquivamento Synology</h3>
                                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
                                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={settingsForm.archive_to_synology}
                                                onChange={(event) => updateSettingsForm({ archive_to_synology: event.target.checked })}
                                                className="h-4 w-4 rounded border-slate-300"
                                            />
                                            <span className="text-sm font-semibold text-slate-700">Arquivar logs no Synology</span>
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-sm font-semibold text-slate-700">Após dias</span>
                                            <input
                                                type="number"
                                                value={settingsForm.archive_after_days}
                                                onChange={(event) => updateSettingsForm({ archive_after_days: event.target.value })}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabPanel>
                </TabPanels>
            </Tabs>

            {isRuleModalOpen && (
                <RuleEditorModal
                    editingRule={editingRule}
                    ruleForm={ruleForm}
                    tags={tags}
                    isSaving={isSavingRule}
                    isUploadingAttachment={isUploadingAttachment}
                    onChange={updateRuleForm}
                    onToggleTag={toggleRuleTag}
                    onUploadAttachment={uploadRuleAttachment}
                    onRemoveAttachment={() => updateRuleForm({ attachment_url: '', attachment_caption: '' })}
                    onClose={() => setIsRuleModalOpen(false)}
                    onSave={saveRule}
                />
            )}
            {isBlockModalOpen && (
                <BlocklistModal
                    editingBlocklistEntry={editingBlocklistEntry}
                    blockForm={blockForm}
                    isSaving={isSavingBlocklist}
                    onChange={updateBlockForm}
                    onClose={() => {
                        setIsBlockModalOpen(false);
                        setEditingBlocklistEntry(null);
                    }}
                    onSave={saveBlocklistEntry}
                />
            )}
            {isBulkBlockModalOpen && (
                <BulkBlocklistModal
                    bulkBlocklistText={bulkBlocklistText}
                    isSaving={isSavingBlocklist}
                    onChange={setBulkBlocklistText}
                    onClose={() => setIsBulkBlockModalOpen(false)}
                    onSave={saveBulkBlocklist}
                />
            )}
            {isTagModalOpen && (
                <TagEditorModal
                    editingTag={editingTag}
                    tagForm={tagForm}
                    isSaving={isSavingTag}
                    onChange={updateTagForm}
                    onToggleScope={toggleTagScope}
                    onClose={() => setIsTagModalOpen(false)}
                    onSave={saveTag}
                />
            )}
        </div>
    );
};

export default AutoResponderPage;
