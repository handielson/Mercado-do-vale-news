// Serviço para gerenciamento de documentos da empresa
// Máximo: 20 documentos por usuário, 10MB por arquivo, apenas PDFs

import { getCurrentAuthUserId } from './authSession';
import { vpsClient } from './vpsClient';
import type { CompanyDocument, DocumentUploadData, CompanyDocumentRow } from '../types/document';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_DOCUMENTS = 20;
const ALLOWED_TYPES = ['application/pdf'];

type TableDataResponse<T> = T[] | { data?: T[]; rows?: T[]; items?: T[]; total?: number };
type SynologyDocumentUpload = {
    ok?: boolean;
    url: string;
    name?: string;
    filename?: string;
    storage?: 'synology' | 'local';
};

function extractRows<T>(response: TableDataResponse<T>): T[] {
    if (Array.isArray(response)) return response;
    return response.data || response.rows || response.items || [];
}

function buildDocumentFileName(userId: string): string {
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${safeUserId}_${Date.now()}.pdf`;
}

function extractFileName(value: string): string {
    try {
        const parsed = new URL(value);
        const name = parsed.pathname.split('/').filter(Boolean).pop();
        if (name) return decodeURIComponent(name);
    } catch {
        // Plain file path from older rows.
    }

    return decodeURIComponent(value.split('?')[0].split('/').filter(Boolean).pop() || value);
}

async function loadCompanyDocuments(pageSize = 200): Promise<CompanyDocumentRow[]> {
    let offset = 0;
    const rows: CompanyDocumentRow[] = [];

    while (true) {
        const response = await vpsClient.get<TableDataResponse<CompanyDocumentRow>>(
            `/table-data/company_documents?limit=${pageSize}&offset=${offset}`
        );
        const batch = extractRows(response);
        rows.push(...batch);
        if (batch.length < pageSize) break;
        offset += pageSize;
    }

    return rows;
}

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
    const userId = await getCurrentAuthUserId() || '00000000-0000-0000-0000-000000000000';

    if (userId === '00000000-0000-0000-0000-000000000000') {
        console.warn('No authenticated user, using mock user ID for document upload');
    }

    // Verificar limite de documentos
    const count = (await loadCompanyDocuments()).filter(document => document.user_id === userId).length;

    if (count >= MAX_DOCUMENTS) {
        throw new Error(`Limite de ${MAX_DOCUMENTS} documentos atingido`);
    }

    const fileName = buildDocumentFileName(userId);
    const uploadFile = new File([data.file], fileName, { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', uploadFile);
    const upload = await vpsClient.upload<SynologyDocumentUpload>('/synology/upload?folder=arquivos', formData);
    if (!upload.url) throw new Error('Erro ao obter URL do documento');

    // Salvar metadados no banco
    try {
        const document = await vpsClient.post<CompanyDocumentRow>('/table-data/company_documents', {
            user_id: userId,
            document_name: data.documentName.trim(),
            file_name: data.file.name,
            file_path: upload.url,
            file_size: data.file.size,
            mime_type: data.file.type
        });

        return rowToDocument(document);
    } catch (dbError: any) {
        await vpsClient.delete(`/synology/file?folder=arquivos&name=${encodeURIComponent(fileName)}`).catch((error) => {
            console.error('Erro ao desfazer upload no Synology:', error);
        });
        throw new Error(`Erro ao salvar documento: ${dbError.message}`);
    }
};

/**
 * Busca todos os documentos do usuário
 */
export const getDocuments = async (): Promise<CompanyDocument[]> => {
    const userId = await getCurrentAuthUserId() || '00000000-0000-0000-0000-000000000000';

    if (userId === '00000000-0000-0000-0000-000000000000') {
        console.warn('No authenticated user, using mock user ID for documents list');
    }

    return (await loadCompanyDocuments())
        .filter(document => document.user_id === userId)
        .sort((a, b) => new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime())
        .map(rowToDocument);
};

/**
 * Deleta um documento (Synology + banco)
 */
export const deleteDocument = async (id: string): Promise<void> => {
    // Buscar documento para obter file_path
    const doc = (await loadCompanyDocuments()).find(document => document.id === id);
    if (!doc) throw new Error('Documento nao encontrado');

    const fileName = extractFileName(doc.file_path || doc.file_name);
    await vpsClient.delete(`/synology/file?folder=arquivos&name=${encodeURIComponent(fileName)}`).catch((error) => {
        console.error('Erro ao deletar do Synology:', error);
    });

    // Deletar do banco
    await vpsClient.delete(`/table-data/company_documents/${id}`);
};

/**
 * Gera URL assinada para visualizar documento
 */
export const getDocumentUrl = async (filePath: string): Promise<string> => {
    if (/^https?:\/\//i.test(filePath)) return filePath;
    return `https://arquivos.xiaomipetrolina.com.br/${encodeURIComponent(extractFileName(filePath))}`;
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
