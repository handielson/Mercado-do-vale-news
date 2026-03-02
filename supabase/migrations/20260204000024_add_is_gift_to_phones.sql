-- Migration: Adicionar campo is_gift na tabela phones
-- Data: 2026-02-04
-- Descrição: Permite marcar produtos como brindes (desconto integral automático no PDV)

-- Verificar se a coluna já existe antes de adicionar
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'phones' 
        AND column_name = 'is_gift'
    ) THEN
        -- Adicionar campo is_gift na tabela phones
        ALTER TABLE phones
        ADD COLUMN is_gift BOOLEAN DEFAULT FALSE NOT NULL;

        -- Adicionar comentário explicativo
        COMMENT ON COLUMN phones.is_gift IS 'Indica se o produto é um brinde. Produtos brindes recebem desconto integral automático no PDV, mas o custo é contabilizado no relatório de lucro.';

        -- Criar índice para facilitar filtros de produtos brindes
        CREATE INDEX IF NOT EXISTS idx_phones_is_gift ON phones(is_gift) WHERE is_gift = TRUE;

        RAISE NOTICE 'Coluna is_gift adicionada com sucesso na tabela phones';
    ELSE
        RAISE NOTICE 'Coluna is_gift já existe na tabela phones';
    END IF;
END $$;
