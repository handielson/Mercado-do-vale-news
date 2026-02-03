-- Políticas de Storage para o bucket de documentos da empresa
-- Este arquivo deve ser executado APÓS criar o bucket manualmente no Supabase Dashboard

-- IMPORTANTE: Antes de executar este script, crie o bucket no Supabase Dashboard:
-- 1. Vá em Storage > Create a new bucket
-- 2. Nome: company-documents
-- 3. Public: false (privado)
-- 4. File size limit: 10MB
-- 5. Allowed MIME types: application/pdf

-- Política: Usuários podem fazer upload de documentos na sua própria pasta
CREATE POLICY "Usuários podem fazer upload de documentos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'company-documents' AND
        auth.uid()::text = (storage.foldername(name))[1] AND
        -- Validar extensão do arquivo
        (storage.extension(name)) = 'pdf'
    );

-- Política: Usuários podem visualizar apenas seus próprios documentos
CREATE POLICY "Usuários podem visualizar seus documentos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'company-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Política: Usuários podem atualizar apenas seus próprios documentos
CREATE POLICY "Usuários podem atualizar seus documentos"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'company-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Política: Usuários podem deletar apenas seus próprios documentos
CREATE POLICY "Usuários podem deletar seus documentos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'company-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Comentário sobre a estrutura de pastas
-- Estrutura esperada: company-documents/{user_id}/{timestamp}.pdf
-- Exemplo: company-documents/550e8400-e29b-41d4-a716-446655440000/1738594800000.pdf
