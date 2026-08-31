-- Blueprint tecnico/comercial gerado por modelo.
-- A URL aponta para o arquivo final ja contendo a marca d'agua da empresa.
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS blueprint_image_url TEXT NULL AFTER eans,
  ADD COLUMN IF NOT EXISTS blueprint_source_hash CHAR(64) NULL AFTER blueprint_image_url,
  ADD COLUMN IF NOT EXISTS blueprint_generated_at DATETIME NULL AFTER blueprint_source_hash;
