export type AutoResponderRuleMatchType = 'exact' | 'contains' | 'any_keyword' | 'all_keywords' | string;
export type AutoResponderRuleReplyType = 'text' | 'product_by_tag' | 'product_search' | string;

export interface AutoResponderConversationState {
    flow: string;
    step: string;
    data?: Record<string, unknown>;
    last_intent?: string | null;
    expires_at?: string | null;
}
export type AutoResponderTagScope = 'conversation' | 'product' | 'rule' | string;
export type AutoResponderBlockPatternType = 'exact' | 'contains' | 'prefix' | string;
export type AutoResponderAiTrainingType = 'store_instruction' | 'faq' | 'category_guidance' | 'policy';

export interface AutoResponderSettings {
    id?: number;
    enabled: boolean | number;
    human_message_in_hours: string;
    human_message_out_of_hours: string;
    human_pause_minutes: number;
    manual_finish_pause_days?: number;
    days_paused_after_finish?: number;
    finish_pause_days?: number;
    response_tone_mode?: 'a' | 'b' | 'c' | 'auto_abc';
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
    conversation_flow_keywords?: Record<string, string[] | string> | string | null;
    conversation_flow_messages?: Record<string, string> | string | null;
    archive_to_synology: boolean | number;
    archive_after_days: number;
    ai_enabled?: boolean | number;
    ai_model?: string;
    ai_daily_limit?: number;
    ai_monthly_limit?: number;
    ai_credit_balance_usd?: number;
    ai_credit_alert_usd?: number;
    ai_input_cost_per_1m_usd?: number;
    ai_output_cost_per_1m_usd?: number;
    openai_api_key?: string;
    openai_admin_api_key?: string;
    has_openai_api_key?: boolean | number;
    openai_api_key_masked?: string;
    has_openai_admin_api_key?: boolean | number;
    openai_admin_api_key_masked?: string;
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
    next_state?: AutoResponderConversationState | string | null;
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
    attendant_name?: string | null;
    attendant_updated_at?: string | null;
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

export interface AutoResponderConversationLog {
    id: number;
    created_at?: string;
    sender?: string | null;
    question?: string | null;
    intent?: string | null;
    matched_rule_id?: number | null;
    matched_count?: number;
    reply_text?: string | null;
    response_time_ms?: number | null;
    ai_assisted?: boolean | number;
    ai_model?: string | null;
}

export interface AutoResponderManualMessageInput {
    message: string;
    attendant_name?: string;
    send_tag_id?: number | null;
    finish_attendance?: boolean;
    pause_minutes?: number;
}

export interface AutoResponderAttendant {
    id: number;
    name: string;
    active: boolean | number;
    created_at?: string;
    updated_at?: string;
}

export interface AutoResponderManualMessageResult extends AutoResponderOk {
    sender: string;
    message: string;
    attendant_name?: string | null;
    send_tag_id?: number | null;
    pause_reason?: string | null;
    paused_until?: string | null;
    evolution?: unknown;
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

export interface AutoResponderAiTraining {
    id: number;
    title: string;
    training_type: AutoResponderAiTrainingType;
    content: string;
    priority: number;
    active: boolean | number;
    created_at?: string;
    updated_at?: string;
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
        ai_finance?: {
            month_responses?: number;
            month_input_tokens?: number;
            month_output_tokens?: number;
            month_estimated_cost_usd?: number;
            today_estimated_cost_usd?: number;
            today_input_tokens?: number;
            today_output_tokens?: number;
            credit_balance_usd?: number;
            credit_alert_usd?: number;
            remaining_credit_usd?: number;
            has_openai_admin_api_key?: boolean | number;
            openai_official_cost_status?: string;
            openai_official_cost_updated_at?: string | null;
            openai_official_month_cost_usd?: number;
            openai_official_remaining_credit_usd?: number;
        };
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

export interface AutoResponderTestFlowStep {
    index: number;
    message: string;
    status_code: number;
    response_time_ms: number;
    replies: AutoResponderTestReply[];
    body?: unknown;
}

export interface AutoResponderTestFlowResult {
    ok: boolean;
    sender: string;
    steps: AutoResponderTestFlowStep[];
    final_purchase_flow?: unknown;
    cleanup?: boolean;
    warning?: string | null;
}

export interface AutoResponderInternalChatResult {
    ok: boolean;
    sender: string;
    message: string;
    status_code: number;
    response_time_ms: number;
    replies: AutoResponderTestReply[];
    body?: unknown;
    final_purchase_flow?: unknown;
}

export interface AutoResponderBotMapFlowStep {
    id: string;
    state: AutoResponderConversationState;
    bot_question: string;
    expected_answer: string;
    contextual_fallback: string;
}

export interface AutoResponderBotMapFlow {
    id: string;
    title: string;
    current_state: AutoResponderConversationState;
    description?: string;
    simulation_messages: string[];
    steps: AutoResponderBotMapFlowStep[];
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
export interface AutoResponderAiTrainingInput {
    title: string;
    training_type: AutoResponderAiTrainingType;
    content: string;
    priority: number;
    active: boolean;
}
export type AutoResponderAiTrainingUpdate = Partial<AutoResponderAiTrainingInput>;

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
    status?: 'paused' | 'active' | 'finished';
    tag_id?: number;
    attendant_name?: string;
}

export interface AutoResponderConversationLogFilters {
    limit?: number;
}

export interface AutoResponderUnansweredFilters {
    limit?: number;
}

export interface AutoResponderAiTrainingFilters {
    type?: AutoResponderAiTrainingType | '';
    active?: boolean | number | '';
}
