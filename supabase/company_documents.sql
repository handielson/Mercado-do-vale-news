-- Tabela para armazenar metadados dos documentos da empresa
-- Permite até 20 documentos por empresa (Certificados, Alvarás, Licenças, etc.)

CREATE TABLE IF NOT EXISTS company_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES company_settings(id) ON DELETE CASCADE,
    document_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL,
    mime_type TEXT DEFAULT 'application/pdf',
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para limitar 20 documentos por usuário
    CONSTRAINT valid_file_size CHECK (file_size > 0 AND file_size <= 10485760) -- 10MB
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_company_documents_user ON company_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_uploaded ON company_documents(uploaded_at DESC);

-- Comentários para documentação
COMMENT ON TABLE company_documents IS 'Armazena metadados de documentos PDF da empresa (máx. 20 por usuário)';
COMMENT ON COLUMN company_documents.document_name IS 'Nome personalizado do documento (ex: Alvará de Funcionamento)';
COMMENT ON COLUMN company_documents.file_path IS 'Caminho no Supabase Storage: {user_id}/{timestamp}.pdf';
COMMENT ON COLUMN company_documents.file_size IS 'Tamanho do arquivo em bytes (máx. 10MB)';

-- Habilitar Row Level Security
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem visualizar apenas seus próprios documentos
CREATE POLICY "Usuários podem visualizar seus próprios documentos"
    ON company_documents FOR SELECT
    USING (auth.uid() = user_id);

-- Política: Usuários podem inserir documentos (máx. 20)
CREATE POLICY "Usuários podem inserir seus próprios documentos"
    ON company_documents FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        (SELECT COUNT(*) FROM company_documents WHERE user_id = auth.uid()) < 20
    );

-- Política: Usuários podem atualizar apenas seus próprios documentos
CREATE POLICY "Usuários podem atualizar seus próprios documentos"
    ON company_documents FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem deletar apenas seus próprios documentos
CREATE POLICY "Usuários podem deletar seus próprios documentos"
    ON company_documents FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_company_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_company_documents_updated_at
    BEFORE UPDATE ON company_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_company_documents_updated_at();
