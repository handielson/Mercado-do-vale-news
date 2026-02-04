/**
 * Warranty Document Types
 * Types for warranty term generation system with template tags
 */

export type DeliveryTypeWarranty = 'store_pickup' | 'delivery';

/**
 * Warranty Document stored in database
 */
export interface WarrantyDocument {
    id: string;
    company_id: string;
    sale_id: string;
    customer_id: string;
    delivery_type: DeliveryTypeWarranty;
    customer_signature?: string; // Base64 encoded image
    warranty_content: string; // Generated content with tags replaced
    created_at: string;
    updated_at: string;
}

/**
 * Input for creating warranty document
 */
export interface WarrantyDocumentInput {
    sale_id: string;
    customer_id: string;
    delivery_type: DeliveryTypeWarranty;
    customer_signature?: string;
    warranty_content: string;
}

/**
 * Data for tag replacement in warranty template
 */
export interface WarrantyTagData {
    // Empresa
    nome_loja: string;
    endereco: string;
    telefone: string;
    email: string;
    cnpj: string;
    logo: string; // URL do logo da empresa

    // Cliente
    nome_cliente: string;
    cpf_cliente: string;
    telefone_cliente?: string;
    email_cliente?: string;

    // Venda
    numero_venda: string;
    data_compra: string;

    // Produto (primeiro produto ou concatenação)
    produto: string;
    marca: string;
    modelo: string;
    cor: string;
    ram: string;
    memoria: string;
    imei1: string;
    imei2: string;

    // Garantia
    dias_garantia: string;
    tipo_garantia: string;

    // Declaração (muda conforme tipo de entrega)
    declaracao_recebimento: string;
}

/**
 * Available warranty template tags
 */
export const WARRANTY_TAGS: Record<string, string> = {
    // Empresa
    nome_loja: 'Nome da Loja',
    endereco: 'Endereço Completo',
    telefone: 'Telefone',
    email: 'Email',
    cnpj: 'CNPJ',
    logo: 'Logo da Empresa (URL)',

    // Cliente
    nome_cliente: 'Nome do Cliente',
    cpf_cliente: 'CPF/CNPJ do Cliente',
    telefone_cliente: 'Telefone do Cliente',
    email_cliente: 'Email do Cliente',

    // Venda
    numero_venda: 'Número da Venda',
    data_compra: 'Data da Compra',

    // Produto
    produto: 'Nome do Produto',
    marca: 'Marca',
    modelo: 'Modelo',
    cor: 'Cor',
    ram: 'Memória RAM',
    memoria: 'Armazenamento',
    imei1: 'IMEI 1',
    imei2: 'IMEI 2',

    // Garantia
    dias_garantia: 'Dias de Garantia',
    tipo_garantia: 'Tipo de Garantia',

    // Declaração
    declaracao_recebimento: 'Declaração de Recebimento'
};
