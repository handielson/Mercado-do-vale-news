-- Migration: Add Order Number and Company Settings
-- Data: 2026-02-04
-- Descrição: Adiciona numeração sequencial de pedidos e configurações da empresa para recibos

-- ============================================
-- 1. Adicionar order_number à tabela sales
-- ============================================

-- Adicionar coluna order_number com auto-increment
ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_number SERIAL;

-- Criar índice único para order_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_order_number ON sales(order_number);

-- Comentário
COMMENT ON COLUMN sales.order_number IS 'Número sequencial do pedido (auto-incremento)';

-- ============================================
-- 2. Criar tabela company_settings
-- ============================================

CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Informações da Empresa
    company_name VARCHAR(255) NOT NULL DEFAULT 'Mercado do Vale',
    address TEXT,
    phone VARCHAR(20),
    cnpj VARCHAR(18),
    email VARCHAR(255),
    
    -- Customização do Recibo
    header_text TEXT,                    -- Texto personalizado no cabeçalho
    footer_text TEXT,                    -- Texto personalizado no rodapé
    warranty_terms TEXT,                 -- Termos de garantia (parte integrante do recibo)
    receipt_logo_url TEXT,               -- URL do logo (opcional)
    
    -- Configurações de Impressão
    receipt_width VARCHAR(10) DEFAULT '80mm', -- '58mm' ou '80mm'
    show_company_info BOOLEAN DEFAULT TRUE,
    show_order_number BOOLEAN DEFAULT TRUE,
    show_timestamp BOOLEAN DEFAULT TRUE,
    show_seller_info BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Comentários
COMMENT ON TABLE company_settings IS 'Configurações da empresa para recibos e documentos';
COMMENT ON COLUMN company_settings.company_name IS 'Nome da empresa exibido nos recibos';
COMMENT ON COLUMN company_settings.header_text IS 'Texto personalizado no cabeçalho do recibo';
COMMENT ON COLUMN company_settings.footer_text IS 'Texto personalizado no rodapé do recibo';
COMMENT ON COLUMN company_settings.warranty_terms IS 'Termos de garantia exibidos no recibo como parte integrante do documento';
COMMENT ON COLUMN company_settings.receipt_logo_url IS 'URL do logo da empresa (opcional)';
COMMENT ON COLUMN company_settings.receipt_width IS 'Largura do papel da impressora térmica (58mm ou 80mm)';

-- ============================================
-- 3. Inserir configurações padrão
-- ============================================

-- Inserir apenas se a tabela estiver vazia
INSERT INTO company_settings (
    company_name,
    address,
    phone,
    cnpj,
    header_text,
    footer_text
)
SELECT 
    'Mercado do Vale',
    'Endereço da loja',
    '(00) 0000-0000',
    '00.000.000/0000-00',
    'Bem-vindo ao Mercado do Vale!',
    'Obrigado pela preferência! Volte sempre!'
WHERE NOT EXISTS (SELECT 1 FROM company_settings);

-- ============================================
-- 4. Trigger para atualizar updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_company_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_company_settings_updated_at
    BEFORE UPDATE ON company_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_company_settings_updated_at();

-- ============================================
-- 5. RLS Policies (Row Level Security)
-- ============================================

-- Habilitar RLS
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Todos podem ler as configurações
CREATE POLICY "Anyone can read company settings"
    ON company_settings
    FOR SELECT
    USING (true);

-- Policy: Apenas admins podem atualizar
-- TODO: Ajustar quando tivermos sistema de roles implementado
CREATE POLICY "Admins can update company settings"
    ON company_settings
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Policy: Apenas admins podem inserir
CREATE POLICY "Admins can insert company settings"
    ON company_settings
    FOR INSERT
    WITH CHECK (true);

-- ============================================
-- 6. Índices para performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_company_settings_created_at ON company_settings(created_at DESC);

-- ============================================
-- Exemplo de Uso
-- ============================================

-- Atualizar configurações da empresa:
-- UPDATE company_settings 
-- SET 
--     company_name = 'Minha Loja',
--     address = 'Rua Exemplo, 123 - Centro',
--     phone = '(11) 98765-4321',
--     cnpj = '12.345.678/0001-90',
--     header_text = 'Produtos de qualidade com os melhores preços!',
--     footer_text = 'Siga-nos nas redes sociais @minhaloja'
-- WHERE id = (SELECT id FROM company_settings LIMIT 1);

-- Buscar número do último pedido:
-- SELECT order_number FROM sales ORDER BY order_number DESC LIMIT 1;
