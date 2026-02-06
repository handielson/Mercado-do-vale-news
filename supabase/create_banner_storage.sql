-- ============================================
-- Script para criar bucket de storage para banners
-- ============================================

-- 1. Criar o bucket 'catalog-banners' (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'catalog-banners',
    'catalog-banners',
    true, -- Bucket público para que as imagens possam ser acessadas sem autenticação
    5242880, -- 5MB em bytes
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Public can view banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON storage.objects;

-- 3. Criar política para UPLOAD (apenas usuários autenticados)
CREATE POLICY "Authenticated users can upload banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'catalog-banners'
);

-- 4. Criar política para VISUALIZAÇÃO (público pode ver)
CREATE POLICY "Public can view banners"
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'catalog-banners'
);

-- 5. Criar política para ATUALIZAÇÃO (apenas usuários autenticados)
CREATE POLICY "Authenticated users can update banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'catalog-banners'
)
WITH CHECK (
    bucket_id = 'catalog-banners'
);

-- 6. Criar política para EXCLUSÃO (apenas usuários autenticados)
CREATE POLICY "Authenticated users can delete banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'catalog-banners'
);

-- ============================================
-- Verificação
-- ============================================

-- Verificar se o bucket foi criado
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'catalog-banners';

-- Verificar políticas criadas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%banner%';
