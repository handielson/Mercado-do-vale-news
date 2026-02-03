-- =====================================================
-- DESABILITAR RLS TEMPORARIAMENTE - APENAS DESENVOLVIMENTO
-- Use apenas para testes, reabilite em produção!
-- =====================================================

-- Desabilitar RLS na tabela company_documents
ALTER TABLE company_documents DISABLE ROW LEVEL SECURITY;

-- IMPORTANTE: Isso remove toda a segurança!
-- Use apenas para desenvolvimento/testes
-- Em produção, reabilite com: ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;
