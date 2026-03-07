export const PAYMENT_RECEIPT_TAGS: Record<string, string> = {
    // Empresa
    nome_loja: 'Nome da Loja',
    endereco: 'Endereço Completo da Loja',
    telefone: 'Telefone da Loja',
    email: 'Email da Loja',
    cnpj: 'CNPJ',
    logo: 'Logo da Empresa (HTML/URL)',

    // Contato (Cliente ou Fornecedor)
    nome_cliente: 'Nome do Cliente/Fornecedor',
    cpf_cliente: 'CPF/CNPJ (se disponível)',
    telefone_cliente: 'Telefone (se disponível)',
    email_cliente: 'Email (se disponível)',

    // Transação
    valor: 'Valor Pago/Recebido (ex: R$ 1.500,00)',
    historico: 'Histórico / Referência da Conta',
    data_emissao: 'Data de Emissão do Recibo',
    numero_recibo: 'Número do Recibo/Conta interna',

    // Declaração dinâmica
    texto_abertura: '"Recebemos de [nome]" ou "Pagamos a [nome]"'
};
