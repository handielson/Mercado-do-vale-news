-- =====================================================
-- CONFIGURAÇÃO DO BUCKET PARA BANNERS DO CATÁLOGO
-- =====================================================
-- Este script cria o bucket e políticas de acesso para
-- armazenar imagens de banners do catálogo

-- IMPORTANTE: Execute este script no SQL Editor do Supabase Dashboard

-- =====================================================
-- 1. CRIAR BUCKET (se não existir)
-- =====================================================
-- Nota: A criação do bucket deve ser feita manualmente no Dashboard:
-- Storage > Create a new bucket
-- Nome: catalog-banners
-- Public: true (para permitir acesso público às imagens)
-- File size limit: 5MB
-- Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp

-- =====================================================
-- 2. POLÍTICAS DE ACESSO (RLS)
-- =====================================================

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Public can view banner images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON storage.objects;

-- Política: Qualquer pessoa pode visualizar banners (público)
CREATE POLICY "Public can view banner images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'catalog-banners');

-- Política: Usuários autenticados podem fazer upload de banners
CREATE POLICY "Authenticated users can upload banners"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'catalog-banners' AND
        auth.role() = 'authenticated' AND
        -- Validar extensão do arquivo
        (storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp')
    );

-- Política: Usuários autenticados podem atualizar banners
CREATE POLICY "Authenticated users can update banners"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'catalog-banners' AND
        auth.role() = 'authenticated'
    );

-- Política: Usuários autenticados podem deletar banners
CREATE POLICY "Authenticated users can delete banners"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'catalog-banners' AND
        auth.role() = 'authenticated'
    );

-- =====================================================
-- 3. ESTRUTURA DE PASTAS RECOMENDADA
-- =====================================================
-- catalog-banners/
--   ├── {timestamp}_{random}.png
--   ├── {timestamp}_{random}.jpg
--   └── {timestamp}_{random}.webp
--
-- Exemplo: catalog-banners/1738594800000_a1b2c3d4.png
-- =====================================================

-- PRONTO! Agora o bucket está configurado e pronto para uso.
-- Lembre-se de criar o bucket manualmente no Dashboard antes de executar este script.
