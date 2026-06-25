/**
 * Mercado do Vale AI Framework v1.0
 * Constants definition for states, skills, and flow control.
 */

export const CHANNELS = {
    WHATSAPP: 'whatsapp',
    INSTAGRAM: 'instagram',
    TELEGRAM: 'telegram',
    WEBCHAT: 'webchat'
};

export const SKILLS = {
    SAUDACAO: 'saudacao',
    CATALOGO: 'catalogo',
    PRODUTO: 'produto',
    ESCOLHA_MEMORIA: 'escolha_memoria',
    ESCOLHA_COR: 'escolha_cor',
    BRINDES: 'brindes',
    CAPINHA: 'capinha',
    ENTREGA: 'entrega',
    FRETE: 'frete',
    PAGAMENTO: 'pagamento',
    PAGAMENTO_MISTO: 'pagamento_misto',
    GARANTIA: 'garantia',
    HORARIO: 'horario',
    ENDERECO_LOJA: 'endereco_loja',
    ESPECIFICACOES_TECNICAS: 'especificacoes_tecnicas',
    RESUMO: 'resumo',
    FINALIZACAO: 'finalizacao',
    EXCECAO: 'excecao',
    HANDOFF: 'handoff'
};

export const STATES = {
    INIT: 'init',
    AWAITING_INPUT: 'awaiting_input',
    PROCESSING: 'processing',
    COMPLETED: 'completed'
};

export const WAITING_FOR = {
    NONE: 'none',
    CEP: 'cep',
    QUANTITY: 'quantity',
    PRODUCT_SELECTION: 'product_selection',
    COLOR_SELECTION: 'color_selection',
    MEMORY_SELECTION: 'memory_selection',
    DELIVERY_METHOD: 'delivery_method',
    PAYMENT_METHOD: 'payment_method',
    CONFIRMATION: 'confirmation',
    HUMAN_ASSISTANCE: 'human_assistance'
};

export const VALIDATION = {
    PENDING: 'pending',
    PASSED: 'passed',
    FAILED_POLICY: 'failed_policy',
    FAILED_FORMAT: 'failed_format'
};

export const FRAMEWORK_VERSION = '1.0.0';
export const SCHEMA_VERSION = 1;
