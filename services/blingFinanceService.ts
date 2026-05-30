import { supabase } from './supabase';
import type { ContaPagar, ContaReceber, BaixaConta, ContaBordero, CreateContaInput } from '../types/finance';
import { getValidToken } from './blingService';

const BASE = '/api/bling?resource=finance';
const MAX_BLING_FINANCE_RANGE_DAYS = 366;

type FinanceListFilters = {
    dataVencimentoInicio?: string;
    dataVencimentoFim?: string;
    situacao?: string;
};

type FinanceListOptions = {
    forceRefresh?: boolean;
};

function financeUrl(params: URLSearchParams): string {
    return `${BASE}&${params.toString()}`;
}

function parseDateOnly(value?: string): Date | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

function splitFinanceDateRange(filters?: FinanceListFilters): FinanceListFilters[] {
    const start = parseDateOnly(filters?.dataVencimentoInicio);
    const end = parseDateOnly(filters?.dataVencimentoFim);

    if (!filters || !start || !end || start > end) return [filters || {}];

    const ranges: FinanceListFilters[] = [];
    let cursor = start;
    while (cursor <= end) {
        const chunkEnd = addUtcDays(cursor, MAX_BLING_FINANCE_RANGE_DAYS - 1);
        const boundedEnd = chunkEnd < end ? chunkEnd : end;
        ranges.push({
            ...filters,
            dataVencimentoInicio: formatDateOnly(cursor),
            dataVencimentoFim: formatDateOnly(boundedEnd),
        });
        cursor = addUtcDays(boundedEnd, 1);
    }

    return ranges;
}

export interface BlingFinanceDebug {
    scope: 'bling-finance-client';
    occurredAt: string;
    method: string;
    url: string;
    query: Record<string, string>;
    status?: number;
    statusText?: string;
    retriedAfter401: boolean;
    request: {
        hasBody: boolean;
        bodyKeys: string[];
        bodySummary?: Record<string, any>;
    };
    response: {
        keys: string[];
        error?: any;
        message?: string;
        detail?: any;
        hint?: string;
        upstreamDebug?: any;
    };
}

export class BlingFinanceError extends Error {
    debug: BlingFinanceDebug;

    constructor(message: string, debug: BlingFinanceDebug) {
        super(message);
        this.name = 'BlingFinanceError';
        this.debug = debug;
    }
}

function parseQuery(url: string): Record<string, string> {
    const query = url.split('?')[1] || '';
    return Object.fromEntries(new URLSearchParams(query).entries());
}

function summarizeBody(body: RequestInit['body']): BlingFinanceDebug['request'] {
    if (!body || typeof body !== 'string') return { hasBody: Boolean(body), bodyKeys: [] };

    try {
        const parsed = JSON.parse(body);
        const bodySummary: Record<string, any> = {};

        for (const key of ['vencimento', 'competencia', 'valor', 'valorRecebido', 'juros', 'desconto']) {
            if (parsed?.[key] != null) bodySummary[key] = parsed[key];
        }
        if (parsed?.contato) bodySummary.contato = { hasId: parsed.contato.id != null, hasNome: Boolean(parsed.contato.nome) };
        if (parsed?.categoria) bodySummary.categoria = { hasId: parsed.categoria.id != null };
        if (parsed?.portador) bodySummary.portador = { hasId: parsed.portador.id != null };
        if (parsed?.historico) bodySummary.hasHistorico = true;

        return { hasBody: true, bodyKeys: Object.keys(parsed || {}).sort(), bodySummary };
    } catch {
        return { hasBody: true, bodyKeys: ['unparseable_json_body'] };
    }
}

function buildFinanceDebug(url: string, options: RequestInit, res: Response, json: any, retriedAfter401: boolean): BlingFinanceDebug {
    return {
        scope: 'bling-finance-client',
        occurredAt: new Date().toISOString(),
        method: String(options.method || 'GET').toUpperCase(),
        url,
        query: parseQuery(url),
        status: res.status,
        statusText: res.statusText,
        retriedAfter401,
        request: summarizeBody(options.body),
        response: {
            keys: json && typeof json === 'object' ? Object.keys(json).sort() : [],
            error: json?.error,
            message: json?.message,
            detail: json?.detail,
            hint: json?.hint,
            upstreamDebug: json?.debug,
        },
    };
}

// â”€â”€â”€ Generic fetch wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function blingFetch(url: string, options: RequestInit = {}): Promise<any> {
    const buildRequest = (rawToken: string): RequestInit => {
        const token = rawToken.startsWith('Bearer') ? rawToken : `Bearer ${rawToken}`;
        return {
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: token,
                'Content-Type': 'application/json',
            },
        };
    };

    const rawToken = await getValidToken();
    let res = await fetch(url, buildRequest(rawToken));
    let retriedAfter401 = false;

    if (res.status === 401) {
        retriedAfter401 = true;
        const refreshedToken = await getValidToken({ forceRefresh: true });
        res = await fetch(url, buildRequest(refreshedToken));
    }

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const hint = json?.hint ? ` â€” ${json.hint}` : '';
        const detail = json?.detail || json?.error?.fields?.map((f: any) => f.msg).join(', ') || json?.message || `Erro ${res.status}`;
        throw new BlingFinanceError(`${detail}${hint}`, buildFinanceDebug(url, options, res, json, retriedAfter401));
    }
    return json;

}

// â”€â”€â”€ Contas a Pagar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function fetchFinanceList<T extends { id: number }>(
    resourceType: 'pagar' | 'receber',
    filters?: FinanceListFilters,
    options?: FinanceListOptions
): Promise<T[]> {
    const fetchPage = async (page: number, chunkFilters: FinanceListFilters) => {
        const params = new URLSearchParams({ resourceType, action: 'list', limite: '100', pagina: String(page) });
        if (chunkFilters.dataVencimentoInicio) params.set('dataVencimentoInicio', chunkFilters.dataVencimentoInicio);
        if (chunkFilters.dataVencimentoFim) params.set('dataVencimentoFim', chunkFilters.dataVencimentoFim);
        if (chunkFilters.situacao) params.set('situacao', chunkFilters.situacao);
        if (options?.forceRefresh) params.set('forceRefresh', '1');
        const json = await blingFetch(financeUrl(params));
        return (json?.data || []) as T[];
    };

    const allContas: T[] = [];
    for (const chunkFilters of splitFinanceDateRange(filters)) {
        if (allContas.length > 0) await new Promise(r => setTimeout(r, 400));
        for (let page = 1; page <= 3; page++) {
            if (page > 1) await new Promise(r => setTimeout(r, 400)); // Delay p/ evitar Rate Limit (400ms)
            const pageData = await fetchPage(page, chunkFilters);
            allContas.push(...pageData);
            if (pageData.length < 100) break; // Se nÃƒÂ£o encheu a pÃƒÂ¡gina, nÃƒÂ£o tem prÃƒÂ³xima
        }
    }

    return allContas.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
}

export const blingFinanceService = {

    async listContasPagar(filters?: FinanceListFilters, options?: FinanceListOptions): Promise<ContaPagar[]> {
        return fetchFinanceList<ContaPagar>('pagar', filters, options);

    },

    async listContasReceber(filters?: FinanceListFilters, options?: FinanceListOptions): Promise<ContaReceber[]> {
        return fetchFinanceList<ContaReceber>('receber', filters, options);

    },

    async getConta(tipo: 'pagar' | 'receber', id: number): Promise<ContaPagar | ContaReceber> {
        const params = new URLSearchParams({ resourceType: tipo, action: 'get', id: String(id) });
        const json = await blingFetch(financeUrl(params));
        return json?.data;
    },

    async getBordero(tipo: 'pagar' | 'receber', id: number): Promise<ContaBordero | null> {
        const params = new URLSearchParams({ resourceType: tipo, action: 'get-bordero', id: String(id) });
        const json = await blingFetch(financeUrl(params));
        return json?.data || null;
    },

    async createConta(input: CreateContaInput): Promise<void> {
        const params = new URLSearchParams({ resourceType: input.tipo, action: 'create' });
        const body: Record<string, any> = {
            vencimento: input.vencimento,
            valor: input.valor,
        };
        if (input.historico) body.historico = input.historico;
        if (input.competencia) body.competencia = input.competencia;
        if (input.numeroBanco) body.numeroBanco = input.numeroBanco;
        if (input.contato?.id) body.contato = { id: input.contato.id };
        else if (input.contato?.nome) body.contato = { nome: input.contato.nome };
        if (input.categoria?.id) body.categoria = { id: input.categoria.id };
        if (input.portador?.id) body.portador = { id: input.portador.id };

        await blingFetch(financeUrl(params), { method: 'POST', body: JSON.stringify(body) });
    },

    async baixarConta(tipo: 'pagar' | 'receber', id: number, baixa: BaixaConta): Promise<void> {
        const params = new URLSearchParams({ resourceType: tipo, action: 'baixar', id: String(id) });
        // Bling API v3 exige o campo 'valorRecebido' para baixas de pagamentos e recebimentos
        const payload = { ...baixa, valorRecebido: baixa.valor };
        delete (payload as any).valor;
        await blingFetch(financeUrl(params), { method: 'POST', body: JSON.stringify(payload) });
    },

    async cancelarConta(tipo: 'pagar' | 'receber', id: number): Promise<void> {
        const params = new URLSearchParams({ resourceType: tipo, action: 'cancelar', id: String(id) });
        await blingFetch(financeUrl(params), { method: 'DELETE' });
    },

    async updateConta(tipo: 'pagar' | 'receber', id: number, data: {
        historico?: string;
        vencimento?: string;
        valor?: number;
        competencia?: string;
        contato?: { id?: number; nome?: string };
    }): Promise<void> {
        const params = new URLSearchParams({ resourceType: tipo, action: 'update', id: String(id) });
        await blingFetch(financeUrl(params), { method: 'PUT', body: JSON.stringify(data) });
    },
};
