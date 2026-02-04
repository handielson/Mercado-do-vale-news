-- Migration: Add Warranty Term Generation System
-- Description: Adds warranty template to company settings and warranty documents table
-- Date: 2026-02-04

-- =====================================================
-- 1. Update company_settings table
-- =====================================================

-- Add warranty template fields
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS warranty_template TEXT;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS warranty_show_logo BOOLEAN DEFAULT true;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS warranty_show_company_name BOOLEAN DEFAULT true;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS warranty_show_cnpj BOOLEAN DEFAULT false;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS warranty_show_phone BOOLEAN DEFAULT true;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS warranty_show_email BOOLEAN DEFAULT true;
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS warranty_show_address BOOLEAN DEFAULT true;

-- Add default warranty template
UPDATE company_settings 
SET warranty_template = 'TERMO DE GARANTIA

{{nome_loja}}
{{endereco}}
{{telefone}} | {{email}}

═══════════════════════════════════════════════════════

DADOS DO CLIENTE                                    DETALHES DA COMPRA

Nome: {{nome_cliente}}                              Nº Venda: {{numero_venda}}
CPF/CNPJ: {{cpf_cliente}}                          Data: {{data_compra}}

═══════════════════════════════════════════════════════

MODELO / RAM / MEMÓRIA          IMEI 1 / IMEI 2                    COR

{{produto}}                     IMEI 1: {{imei1}} | IMEI 2: {{imei2}}    {{cor}}

═══════════════════════════════════════════════════════

CONDIÇÕES DE GARANTIA (Lei 8.078/90)

1. Prazo de Garantia: O produto possui garantia total de {{dias_garantia}} dias, contados da data de entrega. Este prazo já contempla a garantia legal obrigatória de 90 (noventa) dias prevista no Art. 26, inciso II do Código de Defesa do Consumidor (CDC).

2. Cobertura: A garantia cobre exclusivamente vícios de qualidade e defeitos de fabricação que tornem o produto impróprio para consumo ou diminuam seu valor (Art. 18 do CDC).

3. Exclusão de Garantia (Art. 12, § 3º do CDC): A garantia NÃO cobre defeitos resultantes de culpa exclusiva do consumidor ou de terceiro, tais como:
   • Mau uso, quedas, colisões, torções ou danos físicos na tela/carcaça;
   • Oxidação ou danos causados por líquidos (água, suor, vapor), independente de certificação IP do fabricante (pois a vedação sofre desgaste natural);
   • Instalação de softwares não originais (Root, Jailbreak) ou desbloqueio de senhas (iCloud, Google Account);
   • Rompimento do selo de garantia da loja ou intervenção técnica por terceiros não autorizados.

4. Bateria e Consumíveis: Tratando-se de componente sujeito a desgaste natural por uso (vida útil), a garantia da bateria cobre apenas falhas funcionais súbitas e não a degradação normal de capacidade (saúde da bateria), exceto se comprovado vício oculto de fabricação.

5. Política de Troca e Reparo: Conforme Art. 18, § 1º do CDC, a empresa dispõe de até 30 (trinta) dias para sanar o vício. Não sendo o vício sanado neste prazo, o consumidor poderá exigir, alternativamente e à sua escolha: a substituição do produto, a restituição imediata da quantia paga ou o abatimento proporcional do preço.

═══════════════════════════════════════════════════════

DECLARAÇÃO DE RECEBIMENTO E CIÊNCIA:

{{declaracao_recebimento}}

Declaro estar ciente das condições de garantia acima descritas, baseadas na Lei 8.078/90.


___________________________          ___________________________
{{nome_loja}}                        {{nome_cliente}}
Vendedor Responsável                 Assinatura do Cliente'
WHERE warranty_template IS NULL;

-- =====================================================
-- 2. Create warranty_documents table
-- =====================================================

CREATE TABLE IF NOT EXISTS warranty_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    
    -- Tipo de entrega
    delivery_type VARCHAR(20) NOT NULL CHECK (delivery_type IN ('store_pickup', 'delivery')),
    
    -- Assinatura do cliente (Base64)
    customer_signature TEXT,
    
    -- Termo gerado (com tags já substituídas)
    warranty_content TEXT NOT NULL,
    
    -- Metadados
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT warranty_documents_sale_unique UNIQUE(sale_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_warranty_documents_sale ON warranty_documents(sale_id);
CREATE INDEX IF NOT EXISTS idx_warranty_documents_customer ON warranty_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_warranty_documents_company ON warranty_documents(company_id);

-- Add RLS policies
ALTER TABLE warranty_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY warranty_documents_company_isolation ON warranty_documents
    FOR ALL
    USING (company_id = current_setting('app.current_company_id')::UUID);

-- =====================================================
-- 3. Add warranty_document_id to sales table
-- =====================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS warranty_document_id UUID REFERENCES warranty_documents(id);

-- Add comment
COMMENT ON TABLE warranty_documents IS 'Stores generated warranty terms for sales with customer signatures';
COMMENT ON COLUMN warranty_documents.delivery_type IS 'Type of delivery: store_pickup or delivery (affects legal declaration)';
COMMENT ON COLUMN warranty_documents.customer_signature IS 'Base64 encoded customer signature image';
COMMENT ON COLUMN warranty_documents.warranty_content IS 'Generated warranty term with all tags replaced';
