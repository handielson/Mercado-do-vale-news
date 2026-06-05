import { vpsClient } from './vpsClient';
import type {
    AutoResponderAttachmentUpload,
    AutoResponderAiTraining,
    AutoResponderAiTrainingFilters,
    AutoResponderAiTrainingInput,
    AutoResponderAiTrainingUpdate,
    AutoResponderBlocklistEntry,
    AutoResponderBlocklistInput,
    AutoResponderBlocklistUpdate,
    AutoResponderCategoryTag,
    AutoResponderConversation,
    AutoResponderConversationFilters,
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

export const autoResponderService = {
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

    updateProductTags: (productId: string | number, tagIds: number[]): Promise<AutoResponderOk & { tag_ids: number[] }> => {
        return vpsClient.patch<AutoResponderOk & { tag_ids: number[] }>(`/products/${productId}/tags`, {
            tag_ids: tagIds,
        });
    },
};
