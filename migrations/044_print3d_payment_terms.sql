-- Preparação local após 041-043. Exige autorização/backup para aplicação.
-- Histórico recebe versão 0, mantendo as condições originais imutáveis.
ALTER TABLE print3d_order_plans
  ADD COLUMN payment_terms_version TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN initial_payment_bps SMALLINT UNSIGNED NULL,
  ADD COLUMN shipping_payment_mode ENUM('later','full_now','split') NULL,
  ADD COLUMN shipping_initial_cents BIGINT UNSIGNED NULL,
  ADD COLUMN minimum_initial_cents BIGINT UNSIGNED NULL;
-- Novos planos versão 1: entrada de 50% a 100% de todos os produtos.
-- due_on_confirmation_cents e due_before_shipping_cents incluem a parcela
-- do frete escolhida para cada etapa. Linhas de itens mantêm mínimo informativo.
-- Reversão: desligar checkout/pagamentos; preservar estas colunas e o histórico.
