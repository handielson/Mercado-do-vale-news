// Componente para listar documentos da empresa em grade compacta
// Exibe ícones pequenos com nome do documento e ações

import React, { useState } from 'react';
import { FileText, Trash2, ExternalLink, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { CompanyDocument } from '../types/document';
import { deleteDocument, getDocumentUrl, formatFileSize } from '../services/documentService';

interface DocumentListProps {
    documents: CompanyDocument[];
    onDelete: () => void;
}

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onDelete }) => {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleDelete = async (id: string, documentName: string) => {
        if (!confirm(`Deseja realmente excluir "${documentName}"?`)) return;

        setDeletingId(id);
        try {
            await deleteDocument(id);
            toast.success('Documento excluído com sucesso!');
            onDelete();
        } catch (err: any) {
            console.error('Erro ao excluir documento:', err);
            toast.error(err.message || 'Erro ao excluir documento');
        } finally {
            setDeletingId(null);
        }
    };

    const handleView = async (doc: CompanyDocument) => {
        setLoadingId(doc.id);
        try {
            const url = await getDocumentUrl(doc.filePath);
            window.open(url, '_blank');
            toast.success('Abrindo documento...');
        } catch (err: any) {
            console.error('Erro ao abrir documento:', err);
            toast.error('Erro ao abrir documento');
        } finally {
            setLoadingId(null);
        }
    };

    if (documents.length === 0) {
        return (
            <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                <FileText size={48} className="mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 font-medium">Nenhum documento cadastrado</p>
                <p className="text-slate-400 text-sm mt-1">
                    Faça upload de documentos importantes como Alvará, Certificados, etc.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-700">
                    Documentos Cadastrados ({documents.length})
                </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {documents.map((doc) => (
                    <div
                        key={doc.id}
                        className="bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md hover:border-blue-300 transition-all group"
                    >
                        {/* Cabeçalho do card */}
                        <div className="flex items-start gap-2 mb-3">
                            <div className="bg-red-50 p-2 rounded-lg flex-shrink-0">
                                <FileText size={20} className="text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4
                                    className="font-semibold text-sm text-slate-800 truncate leading-tight"
                                    title={doc.documentName}
                                >
                                    {doc.documentName}
                                </h4>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {formatFileSize(doc.fileSize)}
                                </p>
                            </div>
                        </div>

                        {/* Nome do arquivo original */}
                        <p
                            className="text-xs text-slate-500 truncate mb-3 px-1"
                            title={doc.fileName}
                        >
                            📄 {doc.fileName}
                        </p>

                        {/* Ações */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleView(doc)}
                                disabled={loadingId === doc.id}
                                className="flex-1 bg-blue-50 text-blue-600 px-2 py-2 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                                title="Abrir documento em nova aba"
                            >
                                {loadingId === doc.id ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <>
                                        <ExternalLink size={14} />
                                        Abrir
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => handleDelete(doc.id, doc.documentName)}
                                disabled={deletingId === doc.id}
                                className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition-all flex items-center justify-center"
                                title="Excluir documento"
                            >
                                {deletingId === doc.id ? (
                                    <Loader2 className="animate-spin" size={14} />
                                ) : (
                                    <Trash2 size={14} />
                                )}
                            </button>
                        </div>

                        {/* Data de upload (hover) */}
                        <div className="mt-2 pt-2 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs text-slate-400">
                                Enviado em {new Date(doc.uploadedAt).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
