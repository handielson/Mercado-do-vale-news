// Serviço para gerenciamento de documentos da empresa
// Máximo: 20 documentos por usuário, 10MB por arquivo, apenas PDFs

import { supabase } from './supabase';
import type { CompanyDocument, DocumentUploadData, CompanyDocumentRow } from '../types/document';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENTS = 20;
const ALLOWED_TYPES = ['application/pdf'];
const BUCKET_NAME = 'company-documents';

/**
 * Faz upload de um novo documento
 */
export const uploadDocument = async (data: DocumentUploadData): Promise<CompanyDocument> => {
    // Validação de tamanho
    if (data.file.size > MAX_FILE_SIZE) {
        throw new Error('Arquivo muito grande. Tamanho máximo: 10MB');
    }

    // Validação de tipo
    if (!ALLOWED_TYPES.includes(data.file.type)) {
        throw new Error('Apenas arquivos PDF são permitidos');
    }

    // Validação de nome
    if (!data.documentName.trim()) {
        throw new Error('Nome do documento é obrigatório');
    }

    // Obter usuário autenticado ou usar mock
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

    if (!user) {
        console.warn('No authenticated user, using mock user ID for document upload');
    }

    // Verificar limite de documentos
    const { count, error: countError } = await supabase
        .from('company_documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    if (countError) throw countError;
    if (count !== null && count >= MAX_DOCUMENTS) {
        throw new Error(`Limite de ${MAX_DOCUMENTS} documentos atingido`);
    }

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const fileName = `${timestamp}.pdf`;
    const filePath = `${userId}/${fileName}`;

    // Upload para o Storage
    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, data.file, {
            contentType: 'application/pdf',
            upsert: false
        });

    if (uploadError) {
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
    }

    // Salvar metadados no banco
    const { data: document, error: dbError } = await supabase
        .from('company_documents')
        .insert({
            user_id: userId,
            document_name: data.documentName.trim(),
            file_name: data.file.name,
            file_path: filePath,
            file_size: data.file.size,
            mime_type: data.file.type
        })
        .select()
        .single();

    if (dbError) {
        // Rollback: deletar arquivo do storage
        await supabase.storage.from(BUCKET_NAME).remove([filePath]);
        throw new Error(`Erro ao salvar documento: ${dbError.message}`);
    }

    return rowToDocument(document);
};

/**
 * Busca todos os documentos do usuário
 */
export const getDocuments = async (): Promise<CompanyDocument[]> => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

    if (!user) {
        console.warn('No authenticated user, using mock user ID for documents list');
    }

    const { data, error } = await supabase
        .from('company_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(rowToDocument);
};

/**
 * Deleta um documento (storage + banco)
 */
export const deleteDocument = async (id: string): Promise<void> => {
    // Buscar documento para obter file_path
    const { data: doc, error: fetchError } = await supabase
        .from('company_documents')
        .select('file_path')
        .eq('id', id)
        .single();

    if (fetchError) throw fetchError;

    // Deletar do storage
    const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([doc.file_path]);

    if (storageError) {
        console.error('Erro ao deletar do storage:', storageError);
    }

    // Deletar do banco
    const { error: dbError } = await supabase
        .from('company_documents')
        .delete()
        .eq('id', id);

    if (dbError) throw dbError;
};

/**
 * Gera URL assinada para visualizar documento
 */
export const getDocumentUrl = async (filePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filePath, 3600); // 1 hora

    if (error || !data) {
        throw new Error('Erro ao gerar URL do documento');
    }

    return data.signedUrl;
};

/**
 * Formata tamanho de arquivo para exibição
 */
export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Helper: Converte row do banco para tipo CompanyDocument
const rowToDocument = (row: CompanyDocumentRow): CompanyDocument => ({
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    documentName: row.document_name,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    uploadedAt: row.uploaded_at,
    updatedAt: row.updated_at
});
