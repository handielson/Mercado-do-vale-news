-- Estrutura comercial por site. Executar somente após backup e validação em teste.
-- O produto, SKU, fotos, vídeo, características e estoque permanecem em products.
-- Valores monetários são centavos. Nenhuma linha desta tabela baixa ou reserva estoque.
CREATE TABLE IF NOT EXISTS product_storefront_offers (
  product_id CHAR(36) NOT NULL,
  storefront VARCHAR(32) NOT NULL,
  publication_status ENUM('draft', 'published', 'hidden') NOT NULL DEFAULT 'draft',
  title VARCHAR(255) NULL,
  description TEXT NULL,
  category_label VARCHAR(120) NULL,
  slug VARCHAR(255) NULL,
  price_retail BIGINT UNSIGNED NULL,
  price_reseller BIGINT UNSIGNED NULL,
  price_wholesale BIGINT UNSIGNED NULL,
  price_promo BIGINT UNSIGNED NULL,
  promo_start DATETIME NULL,
  promo_end DATETIME NULL,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, storefront),
  KEY idx_storefront_publication (storefront, publication_status, product_id),
  UNIQUE KEY uq_storefront_slug (storefront, slug),
  CONSTRAINT fk_storefront_offer_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Não criar/publicar ofertas automaticamente nesta migration. Os produtos atuais
-- continuam usando o fluxo legado do Mercado do Vale até a migração controlada.
-- As novas ofertas começam como rascunho por padrão e exigem preços conferidos.
-- Reversão operacional: desativar consumidores da tabela e manter as linhas
-- para auditoria. Não apagar dados de ofertas usados em pedidos futuros.
