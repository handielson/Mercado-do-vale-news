// Componente para upload de novos documentos da empresa
// Permite upload de PDFs com nome personalizado (máx. 10MB)

import React, { useState } from 'react';
import { Upload, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDocument } from '../services/documentService';

interface DocumentUploaderProps {
    onUploadSuccess: () => void;
    currentCount: number;
    maxDocuments?: number;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
    onUploadSuccess,
    currentCount,
    maxDocuments = 20
}) => {
    const [documentName, setDocumentName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validar tipo
            if (selectedFile.type !== 'application/pdf') {
                toast.error('Apenas arquivos PDF são permitidos');
                return;
            }

            // Validar tamanho (10MB)
            if (selectedFile.size > 10 * 1024 * 1024) {
                toast.error('Arquivo muito grande. Máximo: 10MB');
                return;
            }

            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!documentName.trim()) {
            toast.error('Digite um nome para o documento');
            return;
        }

        if (!file) {
            toast.error('Selecione um arquivo PDF');
            return;
        }

        if (currentCount >= maxDocuments) {
            toast.error(`Limite de ${maxDocuments} documentos atingido`);
            return;
        }

        setIsUploading(true);
        try {
            await uploadDocument({ documentName: documentName.trim(), file });
            toast.success('Documento enviado com sucesso!');

            // Limpar formulário
            setDocumentName('');
            setFile(null);

            // Resetar input de arquivo
            const fileInput = document.getElementById('document-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

            onUploadSuccess();
        } catch (err: any) {
            console.error('Erro ao enviar documento:', err);
            toast.error(err.message || 'Erro ao enviar documento');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveFile = () => {
        setFile(null);
        const fileInput = document.getElementById('document-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
    };

    const isLimitReached = currentCount >= maxDocuments;

    return (
        <div className={`border rounded-lg p-4 ${isLimitReached ? 'bg-gray-50 border-gray-300' : 'bg-blue-50 border-blue-200'}`}>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Upload size={16} className={isLimitReached ? 'text-gray-500' : 'text-blue-700'} />
                <span className={isLimitReached ? 'text-gray-600' : 'text-blue-800'}>
                    Adicionar Novo Documento
                </span>
                {isLimitReached && (
                    <span className="ml-auto text-xs text-red-600 font-normal">
                        Limite atingido ({currentCount}/{maxDocuments})
                    </span>
                )}
            </h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Nome do Documento *
                    </label>
                    <input
                        type="text"
                        value={documentName}
                        onChange={(e) => setDocumentName(e.target.value)}
                        placeholder="Ex: Alvará de Funcionamento"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                        maxLength={100}
                        disabled={isUploading || isLimitReached}
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Arquivo PDF * (máx. 10MB)
                    </label>

                    {!file ? (
                        <input
                            id="document-file-input"
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={handleFileChange}
                            className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isUploading || isLimitReached}
                        />
                    ) : (
                        <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
                            <FileText size={16} className="text-red-600 flex-shrink-0" />
                            <span className="text-sm text-slate-700 flex-1 truncate">{file.name}</span>
                            <span className="text-xs text-slate-500">
                                {(file.size / 1024).toFixed(1)} KB
                            </span>
                            <button
                                onClick={handleRemoveFile}
                                className="text-red-600 hover:text-red-700 p-1"
                                disabled={isUploading}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleUpload}
                    disabled={isUploading || !documentName.trim() || !file || isLimitReached}
                    className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Enviando...
                        </>
                    ) : (
                        <>
                            <Upload size={18} />
                            Enviar Documento
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
