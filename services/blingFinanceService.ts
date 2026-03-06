import { supabase } from './supabase';
import type { ContaPagar, ContaReceber, BaixaConta, CreateContaInput } from '../types/finance';

const BASE = '/api/bling-finance';

// ─── Token helper ───────────────────────────────────────────
async function getBlingToken(): Promise<string> {
    const { data, error } = await supabase
        .from('company_settings')
        .select('bling_access_token')
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    if (!data?.bling_access_token) throw new Error('Bling não conectado. Configure o token em Integrações > Bling.');
    return `Bearer ${data.bling_access_token}`;
}

// ─── Generic fetch wrapper ───────────────────────────────────
async function blingFetch(url: string, options: RequestInit = {}): Promise<any> {
    const token = await getBlingToken();
    const res = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: token,
            'Content-Type': 'application/json',
        },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const hint = json?.hint ? ` — ${json.hint}` : '';
        const detail = json?.detail || json?.error?.fields?.map((f: any) => f.msg).join(', ') || json?.message || `Erro ${res.status}`;
        throw new Error(`${detail}${hint}`);
    }
    return json;

}

// ─── Contas a Pagar ──────────────────────────────────────────
export const blingFinanceService = {

    async listContasPagar(filters?: {
        dataVencimentoInicio?: string;
        dataVencimentoFim?: string;
        situacao?: string;
    }): Promise<ContaPagar[]> {
        const fetchPage = async (page: number) => {
            const params = new URLSearchParams({ resource: 'pagar', action: 'list', limite: '100', pagina: String(page) });
            if (filters?.dataVencimentoInicio) params.set('dataVencimentoInicio', filters.dataVencimentoInicio);
            if (filters?.dataVencimentoFim) params.set('dataVencimentoFim', filters.dataVencimentoFim);
            if (filters?.situacao) params.set('situacao', filters.situacao);
            const json = await blingFetch(`${BASE}?${params}`);
            return (json?.data || []) as ContaPagar[];
        };

        const allContas: ContaPagar[] = [];
        for (let page = 1; page <= 3; page++) {
            if (page > 1) await new Promise(r => setTimeout(r, 400)); // Delay p/ evitar Rate Limit (400ms)
            const pageData = await fetchPage(page);
            allContas.push(...pageData);
            if (pageData.length < 100) break; // Se não encheu a página, não tem próxima
        }

        return allContas.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    },

    async listContasReceber(filters?: {
        dataVencimentoInicio?: string;
        dataVencimentoFim?: string;
        situacao?: string;
    }): Promise<ContaReceber[]> {
        const fetchPage = async (page: number) => {
            const params = new URLSearchParams({ resource: 'receber', action: 'list', limite: '100', pagina: String(page) });
            if (filters?.dataVencimentoInicio) params.set('dataVencimentoInicio', filters.dataVencimentoInicio);
            if (filters?.dataVencimentoFim) params.set('dataVencimentoFim', filters.dataVencimentoFim);
            if (filters?.situacao) params.set('situacao', filters.situacao);
            const json = await blingFetch(`${BASE}?${params}`);
            return (json?.data || []) as ContaReceber[];
        };

        const allContas: ContaReceber[] = [];
        for (let page = 1; page <= 3; page++) {
            if (page > 1) await new Promise(r => setTimeout(r, 400)); // Delay p/ evitar Rate Limit (400ms)
            const pageData = await fetchPage(page);
            allContas.push(...pageData);
            if (pageData.length < 100) break; // Se não encheu a página, não tem próxima
        }

        return allContas.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    },

    async createConta(input: CreateContaInput): Promise<void> {
        const params = new URLSearchParams({ resource: input.tipo, action: 'create' });
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

        await blingFetch(`${BASE}?${params}`, { method: 'POST', body: JSON.stringify(body) });
    },

    async baixarConta(tipo: 'pagar' | 'receber', id: number, baixa: BaixaConta): Promise<void> {
        const params = new URLSearchParams({ resource: tipo, action: 'baixar', id: String(id) });
        // Bling API v3 exige o campo 'valorRecebido' para baixas de pagamentos e recebimentos
        const payload = { ...baixa, valorRecebido: baixa.valor };
        delete (payload as any).valor;
        await blingFetch(`${BASE}?${params}`, { method: 'POST', body: JSON.stringify(payload) });
    },

    async cancelarConta(tipo: 'pagar' | 'receber', id: number): Promise<void> {
        const params = new URLSearchParams({ resource: tipo, action: 'cancelar', id: String(id) });
        await blingFetch(`${BASE}?${params}`, { method: 'DELETE' });
    },

    async updateConta(tipo: 'pagar' | 'receber', id: number, data: {
        historico?: string;
        vencimento?: string;
        valor?: number;
        competencia?: string;
        contato?: { id?: number; nome?: string };
    }): Promise<void> {
        const params = new URLSearchParams({ resource: tipo, action: 'update', id: String(id) });
        await blingFetch(`${BASE}?${params}`, { method: 'PUT', body: JSON.stringify(data) });
    },
};

