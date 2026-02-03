-- =====================================================
-- SETUP COMPLETO PARA DOCUMENTOS - MODO DESENVOLVIMENTO
-- Execute este script para configurar upload de documentos
-- =====================================================

-- 1. Remover constraint de chave estrangeira (se existir)
ALTER TABLE company_documents 
DROP CONSTRAINT IF EXISTS company_documents_user_id_fkey;

-- 2. Atualizar políticas RLS para permitir usuário mock
DROP POLICY IF EXISTS "Usuários podem inserir documentos (máx. 20)" ON company_documents;
DROP POLICY IF EXISTS "Usuários podem visualizar próprios documentos" ON company_documents;
DROP POLICY IF EXISTS "Usuários podem atualizar próprios documentos" ON company_documents;
DROP POLICY IF EXISTS "Usuários podem deletar próprios documentos" ON company_documents;

-- Criar novas políticas com suporte a usuário mock
CREATE POLICY "Usuários podem inserir documentos (máx. 20)"
    ON company_documents FOR INSERT
    WITH CHECK (
        (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid) AND
        (SELECT COUNT(*) FROM company_documents WHERE user_id = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)) < 20
    );

CREATE POLICY "Usuários podem visualizar próprios documentos"
    ON company_documents FOR SELECT
    USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Usuários podem atualizar próprios documentos"
    ON company_documents FOR UPDATE
    USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);

CREATE POLICY "Usuários podem deletar próprios documentos"
    ON company_documents FOR DELETE
    USING (auth.uid() = user_id OR user_id = '00000000-0000-0000-0000-000000000000'::uuid);
