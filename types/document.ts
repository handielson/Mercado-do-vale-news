// Types para o sistema de gerenciamento de documentos da empresa

export interface CompanyDocument {
    id: string;
    userId: string;
    companyId?: string;
    documentName: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    updatedAt: string;
}

export interface DocumentUploadData {
    documentName: string;
    file: File;
}

export interface CompanyDocumentRow {
    id: string;
    user_id: string;
    company_id?: string;
    document_name: string;
    file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    uploaded_at: string;
    updated_at: string;
}
