// Recibo Avulso — armazenado na VPS (MySQL), independente do Bling

export type TipoReciboAvulso = 'receber' | 'pagar';

export interface AvulsoReceipt {
    id: string;                  // UUID gerado pelo cliente
    tipo: TipoReciboAvulso;
    numero: string;              // Número de série legível (ex: REC-20260602-001)
    nome_contato: string;        // Nome do cliente ou fornecedor
    cpf_cnpj?: string;
    telefone?: string;
    email?: string;
    customer_id?: string;        // FK para tabela customers (opcional, se selecionado)
    valor: number;               // Em reais (ex: 4295.00)
    descricao: string;           // Referência / histórico
    data_emissao: string;        // 'YYYY-MM-DD'
    created_at?: string;
    created_by?: string;         // Admin que emitiu
}

export interface CreateAvulsoReceiptInput {
    tipo: TipoReciboAvulso;
    nome_contato: string;
    cpf_cnpj?: string;
    telefone?: string;
    email?: string;
    customer_id?: string;
    valor: number;
    descricao: string;
    data_emissao: string;
}
