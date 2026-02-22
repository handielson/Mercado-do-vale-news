-- Adiciona coluna de rodapé do catálogo público na tabela company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS catalog_footer_text TEXT DEFAULT '© 2026 Mercado do Vale. Todos os direitos reservados. As informações, preços e disponibilidade de produtos estão sujeitos a alterações sem aviso prévio.';
