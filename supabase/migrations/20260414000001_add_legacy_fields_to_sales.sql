-- Migration: Adicionar campos de migração legado na tabela sales
-- Data: 2026-04-14
-- Descrição: Permite rastrear origem no MV-Gestao e vincular comprovante PDF do Synology

-- ============================================
-- Colunas na tabela sales
-- ============================================

ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS legacy_sale_id TEXT,
  ADD COLUMN IF NOT EXISTS legacy_pdf_url  TEXT;

-- Índice único: garante que a mesma venda do MV-Gestao não seja importada duas vezes
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_legacy_sale_id
  ON sales(legacy_sale_id)
  WHERE legacy_sale_id IS NOT NULL;

COMMENT ON COLUMN sales.legacy_sale_id IS 'ID da venda no sistema antigo MV-Gestao (evita importação duplicada)';
COMMENT ON COLUMN sales.legacy_pdf_url  IS 'URL do comprovante/garantia em PDF no Synology (ex: https://arquivos.xiaomipetrolina.com.br/12345678901_001.pdf)';

-- ============================================
-- Tabela de staging: vendas legado sem cliente no novo sistema
-- ============================================
-- Quando o cliente se cadastrar com o CPF, as vendas pendentes são
-- convertidas automaticamente em registros reais na tabela sales.

CREATE TABLE IF NOT EXISTS legacy_sales_pending (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  legacy_sale_id  TEXT    NOT NULL UNIQUE,   -- ID no MV-Gestao
  customer_cpf    TEXT    NOT NULL,           -- CPF (apenas dígitos)
  sale_date       TIMESTAMP NOT NULL,
  total_amount    INTEGER NOT NULL,           -- em centavos
  payment_method  TEXT    DEFAULT 'Outro',
  items           JSONB   DEFAULT '[]',       -- snapshot dos itens do legado
  pdf_sequence    INTEGER,                    -- nº da sequência para montar a URL (1, 2, 3...)
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legacy_pending_cpf
  ON legacy_sales_pending(customer_cpf);

COMMENT ON TABLE  legacy_sales_pending IS 'Vendas do MV-Gestao cujo cliente ainda não existe no novo sistema. Vinculadas automaticamente quando o cliente se cadastrar.';
COMMENT ON COLUMN legacy_sales_pending.customer_cpf   IS 'CPF do cliente no legado (apenas dígitos). Usado para vincular quando o cliente se cadastrar.';
COMMENT ON COLUMN legacy_sales_pending.pdf_sequence   IS 'Número sequencial da venda do cliente (1 = mais antiga). Compõe o nome do PDF: {cpf}_{pdf_sequence:03d}.pdf';
