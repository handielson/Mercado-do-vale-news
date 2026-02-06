-- =====================================================
-- FIX SIMPLES: Políticas de Storage para catalog-banners
-- =====================================================
-- Este script usa o EMAIL do admin em vez de verificar colunas
-- Funciona independente da estrutura da tabela users
-- =====================================================

-- 1. Remover TODAS as políticas antigas
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

-- 2. Criar políticas SIMPLES

-- Permitir que QUALQUER PESSOA veja as imagens (público)
CREATE POLICY "Public view banners"
ON storage.objects FOR SELECT
USING (bucket_id = 'catalog-banners');

-- Permitir que o ADMIN (handielson@gmail.com) faça upload
CREATE POLICY "Admin upload banners"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'catalog-banners' 
    AND auth.role() = 'authenticated'
    AND auth.email() = 'handielson@gmail.com'
);

-- Permitir que o ADMIN atualize
CREATE POLICY "Admin update banners"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'catalog-banners' 
    AND auth.role() = 'authenticated'
    AND auth.email() = 'handielson@gmail.com'
);

-- Permitir que o ADMIN delete
CREATE POLICY "Admin delete banners"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'catalog-banners' 
    AND auth.role() = 'authenticated'
    AND auth.email() = 'handielson@gmail.com'
);

-- =====================================================
-- PRONTO! Agora deve funcionar usando o email do admin
-- =====================================================
