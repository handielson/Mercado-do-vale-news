-- =====================================================
-- FIX COMPLETO: Políticas de Storage para catalog-banners
-- =====================================================
-- Execute este script no SQL Editor do Supabase
-- SOMENTE ADMIN pode fazer upload/editar/deletar banners
-- =====================================================

-- 1. Remover políticas antigas (se existirem)
DROP POLICY IF EXISTS "Public can view banner images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view catalog banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload catalog banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update catalog banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete catalog banners" ON storage.objects;
DROP POLICY IF EXISTS "Public can view catalog banners" ON storage.objects;
DROP POLICY IF EXISTS "Only ADMIN can upload catalog banners" ON storage.objects;
DROP POLICY IF EXISTS "Only ADMIN can update catalog banners" ON storage.objects;
DROP POLICY IF EXISTS "Only ADMIN can delete catalog banners" ON storage.objects;

-- 2. Criar políticas corretas para o bucket catalog-banners

-- Permitir que QUALQUER PESSOA veja as imagens (público)
CREATE POLICY "Public can view catalog banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalog-banners');

-- Permitir que SOMENTE ADMIN faça upload
CREATE POLICY "Only ADMIN can upload catalog banners"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'catalog-banners' 
    AND auth.role() = 'authenticated'
    AND (
        SELECT client_type FROM public.users 
        WHERE id = auth.uid()
    ) = 'ADMIN'
);

-- Permitir que SOMENTE ADMIN atualize
CREATE POLICY "Only ADMIN can update catalog banners"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'catalog-banners' 
    AND auth.role() = 'authenticated'
    AND (
        SELECT client_type FROM public.users 
        WHERE id = auth.uid()
    ) = 'ADMIN'
);

-- Permitir que SOMENTE ADMIN delete
CREATE POLICY "Only ADMIN can delete catalog banners"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'catalog-banners' 
    AND auth.role() = 'authenticated'
    AND (
        SELECT client_type FROM public.users 
        WHERE id = auth.uid()
    ) = 'ADMIN'
);

-- =====================================================
-- PRONTO! Agora SOMENTE ADMIN pode gerenciar banners
-- =====================================================
