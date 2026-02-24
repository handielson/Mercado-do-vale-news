-- Migration para atualizar a restrição (constraint) de largura de recibo no PostgreSQL

-- Primeiro, desabilita/remove a constraint antiga se existir (para evitar erro ao recriar)
ALTER TABLE company_settings DROP CONSTRAINT IF EXISTS company_settings_receipt_width_check;

-- Adiciona a nova constraint com os 3 tamanhos: 58mm, 80mm e o novo 100mm
ALTER TABLE company_settings ADD CONSTRAINT company_settings_receipt_width_check 
    CHECK (receipt_width IN ('58mm', '80mm', '100mm'));
