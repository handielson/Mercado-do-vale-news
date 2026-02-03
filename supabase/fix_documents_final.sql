-- =====================================================
-- FIX FINAL - DOCUMENTOS EM MODO DESENVOLVIMENTO
-- Execute este script para resolver todos os problemas
-- =====================================================

-- 1. Desabilitar RLS temporariamente (apenas para desenvolvimento)
ALTER TABLE company_documents DISABLE ROW LEVEL SECURITY;

-- 2. Remover constraint de chave estrangeira
ALTER TABLE company_documents 
DROP CONSTRAINT IF EXISTS company_documents_user_id_fkey;

-- PRONTO! Agora você pode:
-- - Fazer upload de documentos
-- - Ver documentos na lista
-- - Deletar documentos

-- IMPORTANTE: Em produção, reabilite o RLS e as constraints!
