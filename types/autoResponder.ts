export type AutoResponderRuleMatchType = 'exact' | 'contains' | 'any_keyword' | 'all_keywords' | string;
export type AutoResponderRuleReplyType = 'text' | 'product_by_tag' | 'product_search' | string;
export type AutoResponderTagScope = 'conversation' | 'product' | 'rule' | string;
export type AutoResponderBlockPatternType = 'exact' | 'contains' | 'prefix' | string;

export interface AutoResponderSettings {
    id?: number;
    enabled: boolean | number;
    human_message_in_hours: string;
    human_message_out_of_hours: string;
    human_pause_minutes: number;
    auto_pause_fallback_threshold: number;
    auto_pause_fallback_minutes: number;
    auto_pause_fallback_message: string;
    max_replies_per_conversation: number;
    max_replies_window_hours: number;
    greeting_prefix: string;
    fallback_message: string;
    signature_enabled: boolean | number;
    signature_message: string;
    send_product_images: boolean | number;
    max_images_per_response: number;
    use_numbered_lists: boolean | number;
    numbered_list_threshold: number;
    numbered_list_validity_minutes: number;
    product_tag_keywords: Record<string, string[] | string> | string | null;
    archive_to_synology: boolean | number;
    archive_after_days: number;
    created_at?: string;
    updated_at?: string;
}

export interface AutoResponderRule {
    id: number;
    name: string;
    match_type: AutoResponderRuleMatchType;
    pattern: string;
    reply_type: AutoResponderRuleReplyType;
    reply_text: string;
    reply_tag_id?: number | null;
    reply_search_query?: string | null;
    attachment_url?: string | null;
    attachment_caption?: string | null;
    auto_apply_tag_id?: number | null;
    tag_ids?: number[] | string | null;
    priority: number;
    active: boolean | number;
    hits?: number;
    created_at?: string;
    updated_at?: string;
}

export interface AutoResponderTag {
    id: number;
    name: string;
    color: string;
    description?: string | null;
    scopes: AutoResponderTagScope[] | string;
    show_on_bot: boolean | number;
    created_at?: string;
    updated_at?: string;
}

export interface AutoResponderCategoryTag {
    id: string | number;
    name: string;
    slug?: string | null;
    parent_id?: string | number | null;
    warranty_days?: number | null;
    product_count?: number;
    in_stock_count?: number;
    appears_on_greeting?: boolean | number;
    updated_at?: string;
}

export interface AutoResponderConversation {
    id?: number;
    sender: string;
    contact_name?: string | null;
    last_message?: string | null;
    last_message_at?: string | null;
    last_reply_at?: string | null;
    paused_until?: string | null;
    pause_reason?: string | null;
    consecutive_fallbacks?: number;
    reply_count?: number;
    total_messages?: number;
    reply_window_started_at?: string | null;
    last_options_offered?: unknown;
    last_options_at?: string | null;
    purchase_flow?: unknown;
    purchase_flow_updated_at?: string | null;
    tag_ids?: number[] | string | null;
    created_at?: string;
    updated_at?: string;
}

export interface AutoResponderBlocklistEntry {
    id: number;
    pattern: string;
    pattern_type: AutoResponderBlockPatternType;
    contact_name?: string | null;
    reason?: string | null;
    active: boolean | number;
    created_at?: string;
    updated_at?: string;
}

export interface AutoResponderUnansweredQuestion {
    question: string;
    occurrences: number;
    last_seen_at: string;
}

export interface AutoResponderStats {
    source?: 'mysql' | 'synology';
    warning?: string;
    archive_date?: string;
    summary?: {
        total_messages?: number;
        unique_senders?: number;
        fallback_messages?: number;
        product_messages?: number;
        human_requests?: number;
        avg_response_time_ms?: number;
        [key: string]: unknown;
    };
    byIntent?: Array<{ intent: string; total: number }>;
    topRules?: Array<{ id: number; name: string; hits: number }>;
    topProducts?: Array<{ id: string; name: string; sku?: string | null; total: number }>;
}

export interface AutoResponderStoreStatus {
    status?: 'open' | 'closing_soon' | 'closed' | 'holiday' | string;
    isOpen?: boolean;
    reason?: string;
    scheduleLabel?: string;
    nextOpenAt?: string | null;
    now?: string;
    [key: string]: unknown;
}

export interface AutoResponderTestReply {
    message: string;
    delaySeconds?: number;
}

export interface AutoResponderTestReplyResult {
    ok: boolean;
    message: string;
    sender: string;
    intent: string;
    matched_count: number;
    matched_rule_id?: number | null;
    response_time_ms: number;
    replies: AutoResponderTestReply[];
    warning?: string | null;
}

export interface AutoResponderAttachmentUpload {
    ok: boolean;
    url: string;
    filename: string;
    storage?: 'synology' | 'local';
}

export interface AutoResponderOk {
    ok: boolean;
}

export type AutoResponderSettingsInput = Partial<Omit<AutoResponderSettings, 'id' | 'created_at' | 'updated_at'>>;
export type AutoResponderRuleInput = Omit<AutoResponderRule, 'id' | 'hits' | 'created_at' | 'updated_at'>;
export type AutoResponderRuleUpdate = Partial<AutoResponderRuleInput>;
export type AutoResponderTagInput = Omit<AutoResponderTag, 'id' | 'created_at' | 'updated_at'>;
export type AutoResponderTagUpdate = Partial<AutoResponderTagInput>;
export type AutoResponderBlocklistInput = Omit<AutoResponderBlocklistEntry, 'id' | 'created_at' | 'updated_at'>;
export type AutoResponderBlocklistUpdate = Partial<AutoResponderBlocklistInput>;

export interface AutoResponderRuleFromQuestionInput {
    log_id?: number;
    question?: string;
    name?: string;
    match_type?: AutoResponderRuleMatchType;
    pattern?: string;
    reply_text?: string;
    priority?: number;
    active?: boolean | number;
    tag_ids?: number[];
}

export interface AutoResponderRuleFilters {
    active?: boolean;
    tag_id?: number;
}

export interface AutoResponderTagFilters {
    scope?: AutoResponderTagScope;
}

export interface AutoResponderConversationFilters {
    limit?: number;
    offset?: number;
    status?: 'paused' | 'active';
    tag_id?: number;
}

export interface AutoResponderUnansweredFilters {
    limit?: number;
}
