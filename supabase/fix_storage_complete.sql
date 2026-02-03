-- =====================================================
-- FIX COMPLETO - STORAGE + TABELA
-- Remove TODAS as políticas RLS que bloqueiam usuário mock
-- =====================================================

-- 1. DESABILITAR RLS NA TABELA
ALTER TABLE company_documents DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER CONSTRAINT DE CHAVE ESTRANGEIRA
ALTER TABLE company_documents 
DROP CONSTRAINT IF EXISTS company_documents_user_id_fkey;

-- 3. REMOVER POLÍTICAS DE STORAGE (bucket company-documents)
DROP POLICY IF EXISTS "Usuários podem fazer upload de documentos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem visualizar seus documentos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem atualizar seus documentos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários podem deletar seus documentos" ON storage.objects;

-- 4. CRIAR POLÍTICAS DE STORAGE SEM AUTENTICAÇÃO (APENAS DESENVOLVIMENTO!)
CREATE POLICY "Allow all uploads to company-documents"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'company-documents');

CREATE POLICY "Allow all reads from company-documents"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'company-documents');

CREATE POLICY "Allow all updates to company-documents"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'company-documents');

CREATE POLICY "Allow all deletes from company-documents"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'company-documents');

-- PRONTO! Agora deve funcionar!
-- IMPORTANTE: Em produção, reabilite as políticas de segurança!
