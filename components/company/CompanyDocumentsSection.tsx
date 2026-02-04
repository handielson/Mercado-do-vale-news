/**
 * CompanyDocumentsSection Component
 * 
 * Handles company document upload and management
 * 
 * Route: Settings → Company Data → Documents Section
 */

import React from 'react';
import { FileText } from 'lucide-react';
import { DocumentUploader } from '../DocumentUploader';
import { DocumentList } from '../DocumentList';
import type { CompanyDocument } from '../../types/document';

interface CompanyDocumentsSectionProps {
    documents: CompanyDocument[];
    isLoading: boolean;
    onDocumentsChange: () => void;
}

export const CompanyDocumentsSection: React.FC<CompanyDocumentsSectionProps> = ({
    documents,
    isLoading,
    onDocumentsChange
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="flex items-center gap-2 font-bold text-slate-800 text-lg mb-6 pb-3 border-b">
                <FileText size={22} className="text-blue-600" />
                Documentos da Empresa
            </h2>

            <div className="space-y-6">
                <DocumentUploader onUploadComplete={onDocumentsChange} />
                <DocumentList
                    documents={documents}
                    isLoading={isLoading}
                    onDelete={onDocumentsChange}
                />
            </div>
        </div>
    );
};
