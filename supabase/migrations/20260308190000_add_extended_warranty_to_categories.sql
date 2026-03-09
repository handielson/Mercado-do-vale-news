-- Fase 1A: Habilitar garantia estendida por categoria
-- Categorias existentes ficam com FALSE por padrão (sem mudança de comportamento)

ALTER TABLE categories
ADD COLUMN IF NOT EXISTS extended_warranty_enabled BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN categories.extended_warranty_enabled IS
  'Se true, exibe opção de garantia estendida ao cliente ao comprar produto desta categoria (ex: Smartphones, Tablets)';
