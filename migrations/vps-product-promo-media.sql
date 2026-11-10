-- promo-media-v1: mídia da promoção por versão (imagem, vídeo e banner da home vinculado).
-- A API cria esta tabela sozinha no primeiro uso (services/productPromoMediaServer.cjs,
-- ensureProductPromoMediaSchema). Este arquivo é o registro/aplicação manual equivalente.
-- Rollback: DROP TABLE product_promo_media;  (não afeta products nem banners)
CREATE TABLE IF NOT EXISTS product_promo_media (
  product_id CHAR(36) NOT NULL PRIMARY KEY,
  image_url VARCHAR(1200) NULL,
  video_url VARCHAR(1200) NULL,
  banner_id VARCHAR(64) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
