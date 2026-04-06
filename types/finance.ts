// Types for Financial module (Contas a Pagar / Receber) — Bling API v3

export type SituacaoConta = 'em_aberto' | 'pago' | 'parcial' | 'cancelado' | 'vencido';
export type TipoConta = 'pagar' | 'receber';

export interface ContaContato {
    id?: number;
    nome: string;
}

export interface ContaPagar {
    id: number;
    vencimento: string;           // 'YYYY-MM-DD'
    valor: number;
    saldo?: number;               // saldo restante
    historico?: string;
    numeroBanco?: string;
    competencia?: string;
    contato?: ContaContato;
    categoria?: { id: number; descricao: string };
    portador?: { id: number; descricao: string };
    situacao: SituacaoConta;
    tipo?: string;
    dataEmissao?: string;
}

export interface ContaReceber {
    id: number;
    vencimento: string;
    valor: number;
    saldo?: number;
    historico?: string;
    numeroBanco?: string;
    competencia?: string;
    contato?: ContaContato;
    categoria?: { id: number; descricao: string };
    portador?: { id: number; descricao: string };
    situacao: SituacaoConta;
    dataEmissao?: string;
}

export interface BaixaConta {
    valor: number;
    data: string;                // 'YYYY-MM-DD'
    juros?: number;
    desconto?: number;
    acrescimo?: number;
    historico?: string;
    portador?: { id: number };
}

export interface CreateContaInput {
    tipo: TipoConta;
    vencimento: string;          // 'YYYY-MM-DD'
    valor: number;
    historico?: string;
    competencia?: string;
    numeroBanco?: string;
    contato?: { id?: number; nome?: string };
    categoria?: { id?: number };
    portador?: { id?: number };
}

export interface FinancialSummary {
    totalEmAberto: number;
    totalVencido: number;
    totalPago: number;
    count: number;
}
