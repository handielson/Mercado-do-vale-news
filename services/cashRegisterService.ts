/**
 * Cash Register Service
 * Cliente das rotas dedicadas de caixa PDV na VPS.
 * Historico imutavel: nao existem metodos de update/delete.
 */

import { vpsClient } from './vpsClient';
import type {
    CashSession,
    CashSessionDetail,
    CashSessionListItem,
    CashSessionSummary,
    CashRectification,
    CloseCashSessionInput,
    CloseCashSessionResult,
    OpenCashSessionInput,
} from '../types/cashRegister';

export interface CashSessionListFilters {
    date_from?: string;
    date_to?: string;
    session_number?: string | number;
    operator?: string;
    status?: 'open' | 'closed' | 'rectified' | '';
    sale_id?: string;
    min_total?: number;
    max_total?: number;
    limit?: number;
    offset?: number;
}

function buildQueryString(filters: Record<string, unknown>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

export const cashRegisterService = {
    async openSession(input: OpenCashSessionInput): Promise<CashSession> {
        return vpsClient.post<CashSession>('/pdv/cash-sessions/open', input);
    },

    async getCurrentSession(): Promise<{ session: CashSession | null; summary?: CashSessionSummary }> {
        return vpsClient.get<{ session: CashSession | null; summary?: CashSessionSummary }>('/pdv/cash-sessions/current');
    },

    async listSessions(filters: CashSessionListFilters = {}): Promise<{ rows: CashSessionListItem[]; total: number }> {
        return vpsClient.get<{ rows: CashSessionListItem[]; total: number }>(
            `/pdv/cash-sessions${buildQueryString(filters as Record<string, unknown>)}`
        );
    },

    async getSessionDetail(sessionId: string, options: { includeSnapshot?: boolean } = {}): Promise<CashSessionDetail> {
        const qs = options.includeSnapshot ? '?include_snapshot=1' : '';
        return vpsClient.get<CashSessionDetail>(`/pdv/cash-sessions/${sessionId}${qs}`);
    },

    async getSessionSummary(sessionId: string): Promise<{ session: CashSession; summary: CashSessionSummary }> {
        return vpsClient.get<{ session: CashSession; summary: CashSessionSummary }>(`/pdv/cash-sessions/${sessionId}/summary`);
    },

    async closeSession(sessionId: string, input: CloseCashSessionInput): Promise<CloseCashSessionResult> {
        return vpsClient.post<CloseCashSessionResult>(`/pdv/cash-sessions/${sessionId}/close`, input);
    },

    async reopenSession(sessionId: string, reason: string): Promise<{ session: CashSession; reopened: boolean }> {
        return vpsClient.post<{ session: CashSession; reopened: boolean }>(`/pdv/cash-sessions/${sessionId}/reopen`, { reason });
    },

    async rectifySession(
        sessionId: string,
        input: { reason: string; new_counted_cash_cents?: number; new_justification?: string }
    ): Promise<{ rectification: CashRectification; document_id: string }> {
        return vpsClient.post<{ rectification: CashRectification; document_id: string }>(`/pdv/cash-sessions/${sessionId}/rectify`, input);
    },

    async createMovement(
        sessionId: string,
        input: { type: 'sangria' | 'suprimento' | 'deposito' | 'retirada'; amount_cents: number; description: string }
    ): Promise<{ id: string; type: string; direction: string; amount_cents: number }> {
        return vpsClient.post(`/pdv/cash-sessions/${sessionId}/movements`, input);
    },

    async uploadDocument(documentId: string, pdfBase64: string): Promise<{ ok: boolean; status: string; cdn_url?: string }> {
        return vpsClient.post(`/pdv/cash-documents/${documentId}/upload`, { pdf_base64: pdfBase64 });
    },

    async registerReprint(documentId: string): Promise<{ ok: boolean; status: string; file_url: string | null; cdn_url: string | null }> {
        return vpsClient.post(`/pdv/cash-documents/${documentId}/reprint`, {});
    },
};
