import { vpsClient } from './vpsClient';
import type {
    AutoResponderAttachmentUpload,
    AutoResponderAiTraining,
    AutoResponderAiTrainingFilters,
    AutoResponderAiTrainingInput,
    AutoResponderAiTrainingUpdate,
    AutoResponderBotMapFlow,
    AutoResponderAttendant,
    AutoResponderBlocklistEntry,
    AutoResponderBlocklistInput,
    AutoResponderBlocklistUpdate,
    AutoResponderCategoryTag,
    AutoResponderConversation,
    AutoResponderConversationFilters,
    AutoResponderConversationLog,
    AutoResponderConversationLogFilters,
    AutoResponderManualMessageInput,
    AutoResponderManualMessageResult,
    AutoResponderOk,
    AutoResponderRule,
    AutoResponderRuleFilters,
    AutoResponderRuleFromQuestionInput,
    AutoResponderRuleInput,
    AutoResponderRuleUpdate,
    AutoResponderSettings,
    AutoResponderSettingsInput,
    AutoResponderStats,
    AutoResponderStoreStatus,
    AutoResponderTestFlowResult,
    AutoResponderInternalChatResult,
    AutoResponderTestReplyResult,
    AutoResponderTag,
    AutoResponderTagFilters,
    AutoResponderTagInput,
    AutoResponderTagUpdate,
    AutoResponderUnansweredFilters,
    AutoResponderUnansweredQuestion,
} from '../types/autoResponder';

function withQuery(path: string, params: object): string {
    const query = new URLSearchParams();
    Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        query.set(key, String(value));
    });
    const qs = query.toString();
    return qs ? `${path}?${qs}` : path;
}

function senderPath(sender: string): string {
    return encodeURIComponent(sender);
}

const localBotMapFlows: AutoResponderBotMapFlow[] = [
    {
        id: 'delivery',
        title: 'Entrega fora de compra',
        current_state: { flow: 'delivery', step: 'awaiting_cep', data: {}, last_intent: 'delivery_question', expires_at: null },
        description: 'Consulta CEP quando o cliente pergunta sobre entrega antes de escolher produto.',
        simulation_messages: ['faz entrega?', '56320690'],
        steps: [
            {
                id: 'delivery-cep',
                state: { flow: 'delivery', step: 'awaiting_cep', data: {}, last_intent: 'delivery_question', expires_at: null },
                bot_question: 'Fazemos entrega sim. Me envie seu CEP com 8 numeros para consultar rapidinho.',
                expected_answer: 'CEP de 8 digitos',
                contextual_fallback: 'Me envie apenas os 8 numeros do CEP. Ex: 56320690',
            },
        ],
    },
    {
        id: 'product_search',
        title: 'Busca de produto',
        current_state: { flow: 'product_search', step: 'awaiting_choice', data: {}, last_intent: 'product_search', expires_at: null },
        description: 'Lista produtos e espera numero, nome do modelo ou pedido de mais opcoes.',
        simulation_messages: ['redmi note 15', '1'],
        steps: [
            {
                id: 'product-choice',
                state: { flow: 'product_search', step: 'awaiting_choice', data: {}, last_intent: 'product_search', expires_at: null },
                bot_question: 'Encontrei estas opcoes. Vamos ficar com qual deles hoje?',
                expected_answer: 'numero, nome ou mais',
                contextual_fallback: 'Me diga o numero da opcao ou o nome do modelo. Ex: 1 ou Redmi Note 15.',
            },
        ],
    },
    {
        id: 'purchase',
        title: 'Compra',
        current_state: { flow: 'purchase', step: 'awaiting_quantity', data: {}, last_intent: 'purchase_intent', expires_at: null },
        description: 'Confirma quantidade, entrega ou retirada e forma de pagamento.',
        simulation_messages: ['redmi note 15', '1', 'comprar', '1', 'finalizar', 'retirada'],
        steps: [
            {
                id: 'purchase-quantity',
                state: { flow: 'purchase', step: 'awaiting_quantity', data: {}, last_intent: 'purchase_intent', expires_at: null },
                bot_question: 'Quantas unidades voce quer?',
                expected_answer: 'numero',
                contextual_fallback: 'Me envie a quantidade em numero. Ex: 1',
            },
            {
                id: 'purchase-fulfillment',
                state: { flow: 'purchase', step: 'awaiting_fulfillment', data: {}, last_intent: 'purchase_fulfillment', expires_at: null },
                bot_question: 'Voce prefere entrega ou retirada na loja?',
                expected_answer: 'entrega ou retirada',
                contextual_fallback: 'Voce prefere entrega ou retirada na loja?',
            },
        ],
    },
    {
        id: 'handoff',
        title: 'Atendimento humano',
        current_state: { flow: 'handoff', step: 'ready', data: {}, last_intent: 'human_request', expires_at: null },
        description: 'Pausa o bot e encaminha para a equipe continuar a conversa.',
        simulation_messages: ['falar com atendente'],
        steps: [
            {
                id: 'handoff-ready',
                state: { flow: 'handoff', step: 'ready', data: {}, last_intent: 'human_request', expires_at: null },
                bot_question: 'Vou chamar nossa equipe para continuar seu atendimento por aqui.',
                expected_answer: 'aguardar atendente',
                contextual_fallback: 'Nossa equipe assume esta conversa assim que possivel.',
            },
        ],
    },
];

export const autoResponderService = {
    getBotMap: async (): Promise<AutoResponderBotMapFlow[]> => {
        return localBotMapFlows.map((flow) => ({
            ...flow,
            current_state: { ...flow.current_state, data: { ...(flow.current_state.data || {}) } },
            simulation_messages: [...flow.simulation_messages],
            steps: flow.steps.map((step) => ({
                ...step,
                state: { ...step.state, data: { ...(step.state.data || {}) } },
            })),
        }));
    },

    getSettings: (): Promise<AutoResponderSettings | null> => {
        return vpsClient.get<AutoResponderSettings | null>('/autoresponder/settings');
    },

    updateSettings: (settings: AutoResponderSettingsInput): Promise<AutoResponderSettings> => {
        return vpsClient.patch<AutoResponderSettings>('/autoresponder/settings', settings);
    },

    listAiTraining: (filters: AutoResponderAiTrainingFilters = {}): Promise<AutoResponderAiTraining[]> => {
        return vpsClient.get<AutoResponderAiTraining[]>(withQuery('/autoresponder/ai-training', filters));
    },

    createAiTraining: (input: AutoResponderAiTrainingInput): Promise<AutoResponderAiTraining> => {
        return vpsClient.post<AutoResponderAiTraining>('/autoresponder/ai-training', input);
    },

    updateAiTraining: (id: number, updates: AutoResponderAiTrainingUpdate): Promise<AutoResponderAiTraining | null> => {
        return vpsClient.patch<AutoResponderAiTraining | null>(`/autoresponder/ai-training/${id}`, updates);
    },

    deleteAiTraining: (id: number): Promise<void> => {
        return vpsClient.delete(`/autoresponder/ai-training/${id}`);
    },

    listRules: (filters: AutoResponderRuleFilters = {}): Promise<AutoResponderRule[]> => {
        return vpsClient.get<AutoResponderRule[]>(withQuery('/autoresponder/rules', filters));
    },

    createRule: (rule: AutoResponderRuleInput): Promise<AutoResponderRule> => {
        return vpsClient.post<AutoResponderRule>('/autoresponder/rules', rule);
    },

    updateRule: (id: number, updates: AutoResponderRuleUpdate): Promise<AutoResponderRule | null> => {
        return vpsClient.patch<AutoResponderRule | null>(`/autoresponder/rules/${id}`, updates);
    },

    deleteRule: (id: number): Promise<void> => {
        return vpsClient.delete(`/autoresponder/rules/${id}`);
    },

    createRuleFromQuestion: (input: AutoResponderRuleFromQuestionInput): Promise<AutoResponderRule> => {
        return vpsClient.post<AutoResponderRule>('/autoresponder/rules/from-question', input);
    },

    uploadAttachment: (file: File): Promise<AutoResponderAttachmentUpload> => {
        const formData = new FormData();
        formData.append('file', file);
        return vpsClient.upload<AutoResponderAttachmentUpload>('/autoresponder/upload-attachment', formData);
    },

    listTags: (filters: AutoResponderTagFilters = {}): Promise<AutoResponderTag[]> => {
        return vpsClient.get<AutoResponderTag[]>(withQuery('/autoresponder/tags', filters));
    },

    createTag: (tag: AutoResponderTagInput): Promise<AutoResponderTag> => {
        return vpsClient.post<AutoResponderTag>('/autoresponder/tags', tag);
    },

    updateTag: (id: number, updates: AutoResponderTagUpdate): Promise<AutoResponderTag | null> => {
        return vpsClient.patch<AutoResponderTag | null>(`/autoresponder/tags/${id}`, updates);
    },

    deleteTag: (id: number): Promise<void> => {
        return vpsClient.delete(`/autoresponder/tags/${id}`);
    },

    listCategoryTags: (): Promise<AutoResponderCategoryTag[]> => {
        return vpsClient.get<AutoResponderCategoryTag[]>('/autoresponder/category-tags');
    },

    listConversations: (filters: AutoResponderConversationFilters = {}): Promise<AutoResponderConversation[]> => {
        return vpsClient.get<AutoResponderConversation[]>(withQuery('/autoresponder/conversations', filters));
    },

    listAttendants: (filters: { active?: boolean | number } = {}): Promise<AutoResponderAttendant[]> => {
        return vpsClient.get<AutoResponderAttendant[]>(withQuery('/autoresponder/attendants', filters));
    },

    createAttendant: (input: { name: string }): Promise<AutoResponderAttendant> => {
        return vpsClient.post<AutoResponderAttendant>('/autoresponder/attendants', input);
    },

    deleteAttendant: (id: number): Promise<void> => {
        return vpsClient.delete(`/autoresponder/attendants/${id}`);
    },

    listConversationLogs: (sender: string, filters: AutoResponderConversationLogFilters = {}): Promise<AutoResponderConversationLog[]> => {
        return vpsClient.get<AutoResponderConversationLog[]>(withQuery(`/autoresponder/conversations/${senderPath(sender)}/logs`, filters));
    },

    pauseConversation: (sender: string, minutes: number, reason = 'admin'): Promise<AutoResponderOk> => {
        return vpsClient.post<AutoResponderOk>(`/autoresponder/conversations/${senderPath(sender)}/pause`, {
            minutes,
            reason,
        });
    },

    resumeConversation: (sender: string): Promise<AutoResponderOk> => {
        return vpsClient.post<AutoResponderOk>(`/autoresponder/conversations/${senderPath(sender)}/resume`, {});
    },

    resetConversationCounters: (sender: string): Promise<AutoResponderOk> => {
        return vpsClient.post<AutoResponderOk>(`/autoresponder/conversations/${senderPath(sender)}/reset-counters`, {});
    },

    updateConversationAttendant: (sender: string, attendant_name: string | null): Promise<AutoResponderOk & { attendant_name?: string | null; previous_attendant_name?: string | null }> => {
        return vpsClient.post<AutoResponderOk & { attendant_name?: string | null; previous_attendant_name?: string | null }>(
            `/autoresponder/conversations/${senderPath(sender)}/attendant`,
            { attendant_name }
        );
    },

    sendManualMessage: (sender: string, input: AutoResponderManualMessageInput): Promise<AutoResponderManualMessageResult> => {
        return vpsClient.post<AutoResponderManualMessageResult>(`/autoresponder/conversations/${senderPath(sender)}/manual-message`, input);
    },

    setConversationTags: (sender: string, tagIds: number[]): Promise<AutoResponderOk & { tag_ids: number[] }> => {
        return vpsClient.post<AutoResponderOk & { tag_ids: number[] }>(
            `/autoresponder/conversations/${senderPath(sender)}/tags`,
            { tag_ids: tagIds }
        );
    },

    listBlocklist: (): Promise<AutoResponderBlocklistEntry[]> => {
        return vpsClient.get<AutoResponderBlocklistEntry[]>('/autoresponder/blocklist');
    },

    createBlocklistEntry: (entry: AutoResponderBlocklistInput): Promise<AutoResponderBlocklistEntry> => {
        return vpsClient.post<AutoResponderBlocklistEntry>('/autoresponder/blocklist', entry);
    },

    updateBlocklistEntry: (id: number, updates: AutoResponderBlocklistUpdate): Promise<AutoResponderBlocklistEntry | null> => {
        return vpsClient.patch<AutoResponderBlocklistEntry | null>(`/autoresponder/blocklist/${id}`, updates);
    },

    bulkCreateBlocklist: (items: Array<AutoResponderBlocklistInput | string>): Promise<AutoResponderOk> => {
        return vpsClient.post<AutoResponderOk>('/autoresponder/blocklist/bulk', { items });
    },

    deleteBlocklistEntry: (id: number): Promise<void> => {
        return vpsClient.delete(`/autoresponder/blocklist/${id}`);
    },

    listUnanswered: (filters: AutoResponderUnansweredFilters = {}): Promise<AutoResponderUnansweredQuestion[]> => {
        return vpsClient.get<AutoResponderUnansweredQuestion[]>(withQuery('/autoresponder/unanswered', filters));
    },

    deleteUnanswered: (question: string): Promise<AutoResponderOk> => {
        return vpsClient.delete<AutoResponderOk>(withQuery('/autoresponder/unanswered', { question }));
    },

    getStats: (filters: { source?: 'mysql' | 'synology'; from?: string } = {}): Promise<AutoResponderStats> => {
        return vpsClient.get<AutoResponderStats>(withQuery('/autoresponder/stats', filters));
    },

    getStoreStatus: (): Promise<AutoResponderStoreStatus> => {
        return vpsClient.get<AutoResponderStoreStatus>('/autoresponder/store-status');
    },

    testReply: (input: { message: string; sender?: string; contactFirstName?: string }): Promise<AutoResponderTestReplyResult> => {
        return vpsClient.post<AutoResponderTestReplyResult>('/autoresponder/test-reply', input);
    },

    testFlow: (input: { messages: string[]; sender?: string; contactFirstName?: string; cleanup?: boolean }): Promise<AutoResponderTestFlowResult> => {
        return vpsClient.post<AutoResponderTestFlowResult>('/autoresponder/test-flow', input);
    },

    sendInternalChatMessage: (input: { message: string; sender?: string; contactFirstName?: string }): Promise<AutoResponderInternalChatResult> => {
        return vpsClient.post<AutoResponderInternalChatResult>('/autoresponder/internal-chat/message', input);
    },

    resetInternalChat: (input: { sender: string }): Promise<AutoResponderOk & { sender: string }> => {
        return vpsClient.post<AutoResponderOk & { sender: string }>('/autoresponder/internal-chat/reset', input);
    },

    simulateBotMapFlow: (flow: AutoResponderBotMapFlow, input: { sender?: string; contactFirstName?: string } = {}): Promise<AutoResponderTestFlowResult> => {
        const safeSender = input.sender?.startsWith('mapa-') ? input.sender : `mapa-${flow.id}-${Date.now()}`;
        return vpsClient.post<AutoResponderTestFlowResult>('/autoresponder/test-flow', {
            messages: flow.simulation_messages,
            sender: safeSender,
            contactFirstName: input.contactFirstName || 'Cliente',
            cleanup: true,
        });
    },

    updateProductTags: (productId: string | number, tagIds: number[]): Promise<AutoResponderOk & { tag_ids: number[] }> => {
        return vpsClient.patch<AutoResponderOk & { tag_ids: number[] }>(`/products/${productId}/tags`, {
            tag_ids: tagIds,
        });
    },

    getWhatsAppConnectionState: (): Promise<{ instance?: { state: string } }> => {
        return vpsClient.get<{ instance?: { state: string } }>('/autoresponder/whatsapp/state');
    },

    getWhatsAppDebug: (): Promise<any> => {
        return vpsClient.get<any>('/autoresponder/whatsapp/debug');
    },

    connectWhatsApp: (): Promise<{ base64?: string; pairingCode?: string; instance?: { state: string } }> => {
        return vpsClient.get<{ base64?: string; pairingCode?: string; instance?: { state: string } }>('/autoresponder/whatsapp/connect');
    },

    disconnectWhatsApp: (): Promise<any> => {
        return vpsClient.post<any>('/autoresponder/whatsapp/disconnect', {});
    },
};
