-- Adiciona colunas para centralização de cabeçalhos e editor de carta de quitação
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS default_a4_header TEXT,
ADD COLUMN IF NOT EXISTS default_thermal_header TEXT,
ADD COLUMN IF NOT EXISTS debt_clearance_template TEXT;

-- Seed com os valores padrão de fábrica (baseados nos Recibos atuais)
UPDATE company_settings
SET default_a4_header = '
<div style="display: flex; align-items: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
    <div style="flex: 1;">
        {{logo}}
    </div>
    <div style="flex: 2; text-align: right;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">{{nome_documento}}</h2>
        <p style="margin: 5px 0 0; font-weight: bold;">{{nome_loja}}</p>
        <p style="margin: 0; font-size: 11px;">CNPJ: {{cnpj}}</p>
        <p style="margin: 0; font-size: 11px;">{{endereco}}</p>
        <p style="margin: 0; font-size: 11px;">{{telefone}} | {{email}}</p>
    </div>
</div>'
WHERE default_a4_header IS NULL;

UPDATE company_settings
SET default_thermal_header = '
<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">
    <div>
        {{logo}}
    </div>
    <div style="text-align:right;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#6b7280;letter-spacing:1px;">{{nome_documento}}</p>
        <p style="font-size:16px;font-weight:800;color:#111827;">{{nome_loja}}</p>
        <p style="font-size:11px;color:#6b7280;">CNPJ: {{cnpj}}</p>
        <p style="font-size:11px;color:#6b7280;">Tel: {{telefone}}</p>
    </div>
</div>'
WHERE default_thermal_header IS NULL;

UPDATE company_settings
SET debt_clearance_template = '
<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px;">
    {{cabecalho_a4}}

    <h1 style="text-align: center; margin: 40px 0; text-transform: uppercase;">CARTA DE QUITAÇÃO DE DÉBITOS</h1>

    <div style="text-align: justify;">
        <p>Declaramos para os devidos fins que o(a) Sr.(a) <strong>{{nome_cliente}}</strong>, inscrito(a) no CPF/CNPJ sob o nº <strong>{{cpf_cliente}}</strong>,</p>
        
        <p>Encontra-se quite referente às suas obrigações financeiras vinculadas à transação/conta identificada pelo código <strong>#{{numero_recibo}}</strong>, tendo liquidado o valor total de <strong>{{valor_quitado}}</strong> na data desta emissão.</p>

        <p>Não constam, até a presente data, quaisquer débitos pendentes vinculados a esta conta pontual nesta empresa.</p>

        <p>Histórico / Referência do Pagamento:<br>
        <em>{{historico_conta}}</em></p>
    </div>

    <div style="margin-top: 80px; text-align: center;">
        <p>___________________________________________________</p>
        <p><strong>{{nome_loja}}</strong><br>
        CNPJ: {{cnpj}}</p>
        <p style="margin-top: 20px;">Emitido em: {{data_emissao}}</p>
    </div>
</div>'
WHERE debt_clearance_template IS NULL;
