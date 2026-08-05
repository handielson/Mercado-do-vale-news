import { vpsClient } from './vpsClient';

export type MarketingApprovalStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'executing'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'expired';

export type MarketingExecutionMode = 'vps_meta_api' | 'lenovo_chrome' | 'manual';
export type MarketingApprovalDecision = 'approve' | 'reject';
export type MarketingJson = Record<string, unknown> | unknown[];

export interface MarketingApprovalRequest {
    id: string;
    channel: string;
    action_type: string;
    title: string;
    target_type: string;
    target_id: string | null;
    target_name: string | null;
    status: MarketingApprovalStatus;
    execution_mode: MarketingExecutionMode;
    current_state: MarketingJson | null;
    proposed_state: MarketingJson;
    evidence: MarketingJson | null;
    financial_impact: MarketingJson | null;
    success_criteria: MarketingJson | null;
    rollback_plan: string;
    execution_payload: MarketingJson | null;
    execution_result: MarketingJson | null;
    requested_by: string | null;
    requested_by_label: string | null;
    reviewed_by: string | null;
    review_note: string | null;
    runner_id: string | null;
    approval_expires_at: string | null;
    approved_at: string | null;
    rejected_at: string | null;
    execution_started_at: string | null;
    executed_at: string | null;
    attempt_count: number;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateMarketingApprovalInput {
    channel: string;
    action_type: string;
    title: string;
    target_type: string;
    target_id?: string | null;
    target_name?: string | null;
    execution_mode?: MarketingExecutionMode;
    current_state?: MarketingJson | null;
    proposed_state: MarketingJson;
    evidence?: MarketingJson | null;
    financial_impact?: MarketingJson | null;
    success_criteria?: MarketingJson | null;
    rollback_plan: string;
    execution_payload?: MarketingJson | null;
    idempotency_key: string;
    approval_expires_at?: string | null;
    requested_by_label?: string | null;
}

export interface MarketingApprovalEvent {
    id: number;
    approval_id: string;
    event_type: string;
    actor_id: string | null;
    actor_label: string | null;
    details: MarketingJson | null;
    created_at: string;
}

interface ListResponse {
    items?: MarketingApprovalRequest[];
    counts?: Partial<Record<MarketingApprovalStatus, number>>;
}

function parseJson(value: unknown): MarketingJson | null {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function normalizeRequest(row: MarketingApprovalRequest): MarketingApprovalRequest {
    return {
        ...row,
        current_state: parseJson(row.current_state),
        proposed_state: parseJson(row.proposed_state) || {},
        evidence: parseJson(row.evidence),
        financial_impact: parseJson(row.financial_impact),
        success_criteria: parseJson(row.success_criteria),
        execution_payload: parseJson(row.execution_payload),
        execution_result: parseJson(row.execution_result),
        attempt_count: Number(row.attempt_count || 0),
    };
}

export const marketingApprovalService = {
    async list(status?: MarketingApprovalStatus | 'all'): Promise<ListResponse> {
        const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
        const response = await vpsClient.get<ListResponse>(`/admin/marketing/approvals${query}`);
        return {
            items: (response.items || []).map(normalizeRequest),
            counts: response.counts || {},
        };
    },

    async create(input: CreateMarketingApprovalInput): Promise<MarketingApprovalRequest> {
        const response = await vpsClient.post<MarketingApprovalRequest>('/admin/marketing/approvals', input);
        return normalizeRequest(response);
    },

    async decide(id: string, decision: MarketingApprovalDecision, note: string): Promise<MarketingApprovalRequest> {
        const response = await vpsClient.post<MarketingApprovalRequest>(
            `/admin/marketing/approvals/${encodeURIComponent(id)}/decision`,
            { decision, note },
        );
        return normalizeRequest(response);
    },

    async listEvents(id: string): Promise<MarketingApprovalEvent[]> {
        const response = await vpsClient.get<{ items?: MarketingApprovalEvent[] }>(
            `/admin/marketing/approvals/${encodeURIComponent(id)}/events`,
        );
        return (response.items || []).map((event) => ({ ...event, details: parseJson(event.details) }));
    },
};
