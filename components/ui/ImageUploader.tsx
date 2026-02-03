import React, { useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '../../utils/image-compression';

interface ImageUploaderProps {
    label: string;
    value: string | null;
    onChange: (base64: string | null) => void;
    recommendedSize?: string;
    maxWidth?: number;
    className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
    label,
    value,
    onChange,
    recommendedSize = '400x400px',
    maxWidth = 400,
    className = ''
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileSelect = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecione apenas arquivos de imagem.');
            return;
        }

        setIsUploading(true);
        try {
            const compressedFile = await compressImage(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                onChange(e.target?.result as string);
            };
            reader.readAsDataURL(compressedFile);
        } catch (err) {
            console.error('Erro ao processar imagem:', err);
            alert('Erro ao processar imagem. Tente novamente.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handleRemove = () => {
        onChange(null);
    };

    return (
        <div className={className}>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
                {label}
                {recommendedSize && (
                    <span className="text-xs font-normal text-slate-500 ml-2">
                        (Recomendado: {recommendedSize})
                    </span>
                )}
            </label>

            <div
                className={`relative border-2 border-dashed rounded-xl transition-all ${isDragging
                        ? 'border-blue-500 bg-blue-50'
                        : value
                            ? 'border-slate-300 bg-slate-50'
                            : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'
                    } ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
                onClick={() => !value && document.getElementById(`upload-${label}`)?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    id={`upload-${label}`}
                    type="file"
                    accept="image/*"
                    onChange={handleInputChange}
                    className="hidden"
                />

                {isUploading ? (
                    <div className="flex flex-col items-center justify-center p-8">
                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                        <p className="text-sm text-slate-600">Processando imagem...</p>
                    </div>
                ) : value ? (
                    <div className="relative group">
                        <img
                            src={value}
                            alt={label}
                            className="w-full h-32 object-contain p-4 rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-xl flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    document.getElementById(`upload-${label}`)?.click();
                                }}
                                className="bg-white text-slate-800 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-100 transition-colors"
                            >
                                Trocar
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove();
                                }}
                                className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <div className="bg-slate-100 p-4 rounded-full mb-3">
                            <Upload className="text-slate-400" size={24} />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">
                            Clique ou arraste uma imagem
                        </p>
                        <p className="text-xs text-slate-500">
                            PNG, JPG ou SVG
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
