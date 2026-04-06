-- Adiciona a coluna local_holidays na tabela company_settings
-- Armazena um array de objetos { date: 'YYYY-MM-DD', label: 'string' }
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS local_holidays JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN company_settings.local_holidays IS 
'Feriados locais ou datas de fechamento definidas pelo admin. Array de { date: YYYY-MM-DD, label: string }';
