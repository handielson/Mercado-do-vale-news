import React from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

export interface AttachmentUploadProps {
    attachmentUrl?: string | null;
    caption?: string | null;
    isUploading?: boolean;
    onUpload: (file: File | null) => void;
    onCaptionChange: (caption: string) => void;
    onRemove: () => void;
}

export const AttachmentUpload: React.FC<AttachmentUploadProps> = ({
    attachmentUrl,
    caption = '',
    isUploading = false,
    onUpload,
    onCaptionChange,
    onRemove,
}) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onUpload(event.target.files?.[0] || null);
        event.currentTarget.value = '';
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        onUpload(event.dataTransfer.files?.[0] || null);
    };

    return (
        <div className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <span className="block text-sm font-semibold text-slate-700">Imagem da resposta</span>
                    {attachmentUrl && <span className="mt-1 block text-xs font-semibold text-emerald-700">Anexo enviado</span>}
                </div>
                <label
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                >
                    <ImagePlus size={16} />
                    {isUploading ? 'Enviando...' : 'Enviar imagem'}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={handleFileChange}
                    />
                </label>
            </div>

            {attachmentUrl && (
                <div className="mt-4 space-y-3">
                    <input
                        value={attachmentUrl}
                        readOnly
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 outline-none"
                    />
                    <label className="block">
                        <span className="mb-1 block text-sm font-semibold text-slate-700">Legenda do anexo</span>
                        <input
                            value={caption || ''}
                            onChange={(event) => onCaptionChange(event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                        <Trash2 size={15} />
                        Remover anexo
                    </button>
                </div>
            )}
        </div>
    );
};

export default AttachmentUpload;
