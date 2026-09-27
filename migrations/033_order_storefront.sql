-- Origem operacional dos pedidos online. Preparada a partir do SHOW CREATE TABLE
-- de orders na VPS em 26/09/2026. Aplicar somente com backup e em janela aprovada.
-- Pedidos existentes e o checkout atual permanecem no Mercado do Vale.
ALTER TABLE orders
  ADD COLUMN storefront ENUM('mercado_do_vale', 'loja_3d') NOT NULL DEFAULT 'mercado_do_vale'
    AFTER company_id,
  ADD KEY idx_orders_storefront_created (storefront, created_at);

-- O checkout 3D deve gravar loja_3d somente por rota autenticada do servidor.
-- Não permitir que o navegador escolha a origem nem usar /table-data/orders.
-- Reversão operacional: desativar o checkout 3D. Não remover a coluna após
-- existirem pedidos 3D, pois a origem integra a trilha histórica.
